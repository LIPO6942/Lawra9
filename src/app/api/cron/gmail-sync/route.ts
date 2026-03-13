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
  getGmailAttachment,
  extractEmailBody,
  findPdfAttachments,
  refreshAccessToken,
} from '@/lib/gmail-client';
import { parseStegEmail } from '@/lib/parsers/steg';
import { parseOrangeEmail } from '@/lib/parsers/orange';
import { FieldValue } from 'firebase-admin/firestore';
import { format, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';

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
        
        // Charger les documents récents pour l'anti-doublon métier de façon optimisée
        const userDocsRef = db.collection('users').doc(userId).collection('documents');
        const recentDocsSnap = await userDocsRef.orderBy('createdAt', 'desc').limit(100).get();
        const recentDocs = recentDocsSnap.docs.map((d: any) => d.data());

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
                // Fetch + parse le message complet
                const fullMsg = await getGmailMessage(accessToken, msg.id);
                const { text, html } = extractEmailBody(fullMsg.payload);

                // Parser selon le fournisseur
                const parsed = provider.parser(text, html);

                // ── Filtrage par statut de paiement ────────────────────────────
                const isAlreadyPaid = 
                  text.toLowerCase().includes('facture acquittée') || 
                  text.toLowerCase().includes('paiement reçu') ||
                  text.toLowerCase().includes('votre paiement a bien été pris en compte') ||
                  text.toLowerCase().includes('facture déjà payée');

                if (isAlreadyPaid) {
                  stats.totalSkipped++;
                  continue;
                }

                // ── Anti-doublon technique et métier ───────────────────────────
                let isDuplicate = false;
                const targetSupplierTokens = provider.name === 'STEG' ? ['steg'] : ['orange', 'otn'];
                
                // Trouver la date de référence pour comparer le mois
                let dateReference: Date | null = null;
                if (parsed.dateFacture) dateReference = parseISO(parsed.dateFacture);
                else if (parsed.dateEcheance) dateReference = parseISO(parsed.dateEcheance);
                else dateReference = new Date(parseInt(fullMsg.internalDate));

                for (const dData of recentDocs) {
                  // 1. Anti-doublon technique (déjà importé par Gmail)
                  if (dData.emailId === msg.id) {
                    isDuplicate = true; break;
                  }

                  // 2. Anti-doublon métier (Saisie manuelle existante)
                  const docSupplier = (dData.supplier || dData.category || '').toLowerCase();
                  const isMatchSupplier = targetSupplierTokens.some((t: string) => docSupplier.includes(t));
                  if (!isMatchSupplier) continue;

                  // a) Vérifier si le montant est exactement le même
                  if (parsed.montant && dData.amount === `${parsed.montant.toFixed(3)} TND`) {
                    isDuplicate = true; break;
                  }

                  // b) Vérifier si la période textuelle est identique
                  if (parsed.periode && dData.consumptionPeriod && parsed.periode.toLowerCase() === dData.consumptionPeriod.toLowerCase()) {
                    isDuplicate = true; break;
                  }

                  // c) Vérifier le mois et l'année
                  if (dateReference && isValid(dateReference)) {
                    // On vérifie de préférence billingStartDate, sinon issueDate,dueDate,createdAt
                    const docDates = [dData.billingStartDate, dData.issueDate, dData.dueDate, dData.createdAt].filter(Boolean);
                    for (const dStr of docDates) {
                      const dDate = new Date(dStr);
                      if (isValid(dDate) && dDate.getMonth() === dateReference.getMonth() && dDate.getFullYear() === dateReference.getFullYear()) {
                        isDuplicate = true; break;
                      }
                    }
                  }
                  if (isDuplicate) break;
                }

                if (isDuplicate) {
                  console.log(`[Gmail Cron] Doublon détecté pour l'email ${msg.id}`);
                  stats.totalSkipped++;
                  continue;
                }

                // Construire et sauvegarder le document
                let notesText = `Importé automatiquement (cron quotidien).\nExtrait : ${parsed.rawText.slice(0, 200)}`;
                if (parsed.invoiceUrl) {
                  notesText = `📎 [Consulter la facture en ligne](${parsed.invoiceUrl})\n\n${notesText}`;
                }

                // ── Gérer les pièces jointes PDF ────────────────────────────
                const pdfInfos = findPdfAttachments(fullMsg.payload);
                let fileData: any = null;

                if (pdfInfos.length > 0) {
                  const attachment = await getGmailAttachment(accessToken, msg.id, pdfInfos[0].attachmentId);
                  fileData = {
                    content: attachment,
                    contentType: 'application/pdf',
                    name: pdfInfos[0].filename
                  };
                }

                const docId = `gmail-${msg.id}`;
                await userDocsRef.doc(docId).set({
                  id: docId,
                  userId,
                  emailId: msg.id,
                  name: buildInvoiceName(provider.name, parsed.periode),
                  category: provider.category,
                  source: provider.name,
                  amount: parsed.montant ? `${parsed.montant.toFixed(3)} TND` : undefined,
                  supplier: provider.name === 'ORANGE_TN' ? 'Orange' : provider.supplier,
                  dueDate: parsed.dateEcheance || null,
                  issueDate: parsed.dateFacture || null,
                  invoiceNumber: parsed.invoiceNumber || null,
                  consumptionPeriod: parsed.periode || null,
                  referenceClient: parsed.referenceClient || null,
                  status: 'pending' as const,
                  autoImported: true,
                  importedAt: FieldValue.serverTimestamp(),
                  createdAt: new Date(parseInt(fullMsg.internalDate)).toISOString(),
                  notes: notesText,
                  fileBase64: fileData?.content || null,
                  fileName: fileData?.name || null
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
