/**
 * Cron Job : /api/cron/gmail-sync
 * Tourne automatiquement chaque matin (configurable dans vercel.json)
 * Pour TOUS les utilisateurs ayant connecté Gmail
 * 
 * Sécurisé par CRON_SECRET (même variable que le cron de notifications)
 */

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  searchGmailMessages,
  getGmailMessage,
  extractEmailBody,
  refreshAccessToken,
} from '@/lib/gmail-client';
import { parseStegEmail } from '@/lib/parsers/steg';
import { parseOrangeEmail } from '@/lib/parsers/orange';
import { FieldValue } from 'firebase-admin/firestore';

// Force Next.js à ne pas pré-rendre cette route au build
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

// Fournisseurs ciblés
const PROVIDERS = [
  {
    name: 'STEG' as const,
    query: 'from:facturemail@steg.com.tn',
    parser: parseStegEmail,
    category: 'STEG' as const,
    supplier: 'STEG',
  },
  {
    name: 'ORANGE_TN' as const,
    query: 'from:factures.otn@orange.com',
    parser: parseOrangeEmail,
    category: 'Internet' as const,
    supplier: 'Orange Tunisie',
  },
];

export async function GET(request: Request) {
  // ── Vérification du secret CRON (même pattern que send-invoice-reminders) ──
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  const stats = { usersProcessed: 0, totalImported: 0, totalSkipped: 0, totalErrors: 0 };

  try {
    // ── 1. Récupérer tous les utilisateurs ayant une intégration Gmail active ──
    const usersSnap = await db.collection('users').get();
    console.log(`[Gmail Cron] ${usersSnap.size} utilisateur(s) à vérifier`);

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      try {
        // Vérifier si cet utilisateur a Gmail connecté et actif
        const integrationSnap = await db
          .collection('users').doc(userId)
          .collection('integrations').doc('gmail')
          .get();

        if (!integrationSnap.exists || integrationSnap.data()?.status !== 'active') {
          continue; // Pas de Gmail connecté pour cet utilisateur
        }

        stats.usersProcessed++;
        let { accessToken, refreshToken, expiresAt } = integrationSnap.data()!;

        // ── 2. Rafraîchir le token si expiré ───────────────────────────────
        const isExpired = new Date(expiresAt) <= new Date(Date.now() + 60_000);
        if (isExpired) {
          try {
            const refreshed = await refreshAccessToken(refreshToken);
            accessToken = refreshed.access_token;
            await integrationSnap.ref.update({
              accessToken,
              expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            });
          } catch (refreshErr: any) {
            console.error(`[Gmail Cron] Refresh token échoué pour ${userId}:`, refreshErr.message);
            // Marquer comme expiré pour que l'utilisateur se reconnecte
            await integrationSnap.ref.update({ status: 'expired' });
            continue;
          }
        }

        // ── 3. Scanner les emails de chaque fournisseur ────────────────────
        for (const provider of PROVIDERS) {
          try {
            // Chercher uniquement les emails des 7 derniers jours (cron quotidien)
            const messages = await searchGmailMessages(
              accessToken,
              `${provider.query} newer_than:7d`,
              10
            );

            for (const msg of messages) {
              try {
                // Anti-doublon : vérifier si emailId déjà importé
                const existing = await db.collection('documents')
                  .where('emailId', '==', msg.id)
                  .where('userId', '==', userId)
                  .limit(1)
                  .get();

                if (!existing.empty) {
                  stats.totalSkipped++;
                  continue;
                }

                // Fetch + parse le message complet
                const fullMsg = await getGmailMessage(accessToken, msg.id);
                const { text, html } = extractEmailBody(fullMsg.payload);
                const parsed = provider.parser(text, html);

                // Construire et sauvegarder le document
                await db.collection('documents').add({
                  userId,
                  emailId: msg.id,
                  name: buildInvoiceName(provider.name, parsed.periode),
                  category: provider.category,
                  source: provider.name,
                  amount: parsed.montant ? `${parsed.montant.toFixed(3)} TND` : undefined,
                  supplier: provider.supplier,
                  dueDate: parsed.dateEcheance || null,
                  issueDate: parsed.dateFacture || null,
                  invoiceNumber: parsed.invoiceNumber || null,
                  consumptionPeriod: parsed.periode || null,
                  referenceClient: parsed.referenceClient || null,
                  status: 'pending',
                  autoImported: true,
                  importedAt: FieldValue.serverTimestamp(),
                  createdAt: new Date(parseInt(fullMsg.internalDate)).toISOString(),
                  notes: `Importé automatiquement (cron quotidien).\nExtrait : ${parsed.rawText.slice(0, 200)}`,
                });

                stats.totalImported++;
                console.log(`[Gmail Cron] ✅ ${provider.name} importé pour ${userId}`);
              } catch (msgErr: any) {
                console.error(`[Gmail Cron] Erreur message ${msg.id}:`, msgErr.message);
                stats.totalErrors++;
              }
            }
          } catch (providerErr: any) {
            console.error(`[Gmail Cron] Erreur provider ${provider.name}:`, providerErr.message);
            stats.totalErrors++;
          }
        }

        // Mettre à jour lastSyncAt
        await integrationSnap.ref.update({ lastSyncAt: FieldValue.serverTimestamp() });

      } catch (userErr: any) {
        console.error(`[Gmail Cron] Erreur utilisateur ${userId}:`, userErr.message);
        stats.totalErrors++;
      }
    }

    console.log('[Gmail Cron] Terminé :', stats);
    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error('[Gmail Cron] Erreur fatale:', error.message);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

// ── Helper ───────────────────────────────────────────────────────────────────

function buildInvoiceName(source: string, periode?: string): string {
  const label = source === 'STEG' ? 'Facture STEG' : 'Facture Orange TN';
  return periode ? `${label} — ${periode}` : `${label} — ${new Date().toLocaleDateString('fr-TN')}`;
}
