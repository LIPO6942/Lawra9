/**
 * Route : POST /api/gmail/sync
 * Scan Gmail pour trouver les emails STEG et Orange TN non encore importés
 * Parse les données et les sauvegarde dans Firestore (collection 'documents')
 * Nécessite : Authorization: Bearer <firebase-id-token>
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { format, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';

// Fournisseurs ciblés : query Gmail + parser associé
const PROVIDERS = [
  {
    name: 'STEG' as const,
    query: 'from:facturemail@steg.com.tn',
    parser: parseStegEmail,
    category: 'STEG' as const,
  },
  {
    name: 'ORANGE_TN' as const,
    query: 'from:factures.otn@orange.com',
    parser: parseOrangeEmail,
    category: 'Internet' as const,
  },
];

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authentifier l'utilisateur Firebase ────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // ── 2. Charger les tokens Gmail depuis Firestore ───────────────────────
    const db = getAdminDb();
    const integrationRef = db
      .collection('users')
      .doc(userId)
      .collection('integrations')
      .doc('gmail');

    const integrationSnap = await integrationRef.get();
    if (!integrationSnap.exists || integrationSnap.data()?.status !== 'active') {
      return NextResponse.json(
        { error: 'Gmail non connecté. Veuillez d\'abord autoriser l\'accès.' },
        { status: 403 }
      );
    }

    let { accessToken, refreshToken, expiresAt } = integrationSnap.data()!;

    // ── 3. Rafraîchir le token si expiré ─────────────────────────────────
    const isExpired = new Date(expiresAt) <= new Date(Date.now() + 60_000); // marge 1 min
    if (isExpired) {
      console.log('[Gmail Sync] Token expiré, rafraîchissement...');
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
      await integrationRef.update({
        accessToken,
        expiresAt: newExpiry.toISOString(),
      });
    }

    // ── 4. Scanner chaque fournisseur ─────────────────────────────────────
    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [] as string[],
    };

    // Charger les documents récents pour l'anti-doublon métier de façon optimisée
    const userDocsRef = db.collection('users').doc(userId).collection('documents');
    const recentDocsSnap = await userDocsRef.orderBy('createdAt', 'desc').limit(100).get();
    const recentDocs = recentDocsSnap.docs.map((d: any) => d.data());

    for (const provider of PROVIDERS) {
      try {
        // Chercher les 10 derniers emails de ce fournisseur
        const messages = await searchGmailMessages(
          accessToken,
          `${provider.query} newer_than:90d`,
          10
        );

        console.log(`[Gmail Sync] ${provider.name}: ${messages.length} email(s) trouvé(s)`);

        for (const msg of messages) {
          try {
            // Récupérer le message complet
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
              results.skipped++;
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
              const isMatchSupplier = targetSupplierTokens.some(t => docSupplier.includes(t));
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
              console.log(`[Gmail Sync] Doublon détecté pour l'email ${msg.id}`);
              results.skipped++;
              continue;
            }

            // Construire le document Lawra9 (compatible avec le type Document existant)
            let notesText = `Importé automatiquement depuis Gmail.\nExtrait : ${parsed.rawText.slice(0, 200)}`;
            if (parsed.invoiceUrl) {
              notesText = `📎 [Consulter la facture en ligne](${parsed.invoiceUrl})\n\n${notesText}`;
            }

            // ── 4c. Gérer les pièces jointes PDF ────────────────────────────
            const pdfInfos = findPdfAttachments(fullMsg.payload);
            let fileData: any = null;

            if (pdfInfos.length > 0) {
              const attachment = await getGmailAttachment(accessToken, msg.id, pdfInfos[0].attachmentId);
              // Les fichiers sont stockés en Base64 dans Firestore (compatible avec notre système IDB si chargé)
              fileData = {
                content: attachment, // base64url string
                contentType: 'application/pdf',
                name: pdfInfos[0].filename
              };
            }

            // ID unique basé sur l'ID Gmail pour éviter les conflits
            const docId = `gmail-${msg.id}`;
            const docData = {
              id: docId,
              userId,
              emailId: msg.id,
              name: buildInvoiceName(provider.name, parsed.periode),
              category: provider.category,
              source: provider.name,
              amount: parsed.montant ? `${parsed.montant.toFixed(3)} TND` : undefined,
              supplier: provider.name === 'STEG' ? 'STEG' : 'Orange',
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
              fileBase64: fileData?.content || null, // On stocke le base64 pour que le frontend puisse créer un Blob
              fileName: fileData?.name || null
            };

            // Sauvegarder dans Firestore (collection spécifique à l'utilisateur)
            await userDocsRef.doc(docId).set(docData);

            results.imported++;
            results.details.push(
              `✅ ${provider.name} — ${parsed.montant ? parsed.montant.toFixed(3) + ' TND' : 'montant inconnu'} — ${parsed.dateEcheance || 'échéance inconnue'}`
            );
          } catch (msgErr: any) {
            console.error(`[Gmail Sync] Erreur message ${msg.id}:`, msgErr.message);
            results.errors++;
          }
        }
      } catch (providerErr: any) {
        console.error(`[Gmail Sync] Erreur fournisseur ${provider.name}:`, providerErr.message);
        results.errors++;
      }
    }

    // ── 5. Mettre à jour lastSyncAt ───────────────────────────────────────
    await integrationRef.update({ lastSyncAt: FieldValue.serverTimestamp() });

    console.log(`[Gmail Sync] Terminé pour ${userId}:`, results);

    return NextResponse.json({
      success: true,
      message: `${results.imported} facture(s) importée(s), ${results.skipped} ignorée(s)`,
      ...results,
    });
  } catch (error: any) {
    console.error('[Gmail Sync] Erreur fatale:', error.message);
    return NextResponse.json({ error: 'Erreur serveur', details: error.message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildInvoiceName(source: string, periode?: string): string {
  const label = source === 'STEG' ? 'Facture STEG' : 'Facture Orange TN';
  return periode ? `${label} — ${periode}` : `${label} — ${new Date().toLocaleDateString('fr-TN')}`;
}
