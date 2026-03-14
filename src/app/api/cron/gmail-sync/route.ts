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
                const searchContent = (text + ' ' + (html || '')).toLowerCase();
                const isAlreadyPaid = 
                  searchContent.includes('facture acquittée') || 
                  searchContent.includes('paiement reçu') ||
                  searchContent.includes('votre paiement a bien été pris en compte') ||
                  searchContent.includes('facture déjà payée') ||
                  searchContent.includes('montant payé') ||
                  searchContent.includes('solde : 0') ||
                  searchContent.includes('solde: 0');

                if (isAlreadyPaid) {
                  console.log(`[Gmail Cron] Facture payée ignorée pour l'email ${msg.id}`);
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

                const gmailPeriod = extractMonthYear(parsed.periode) || 
                                   (dateReference && isValid(dateReference) ? { month: dateReference.getMonth(), year: dateReference.getFullYear() } : null);

                for (const dData of recentDocs) {
                  // 1. Anti-doublon technique (déjà importé par Gmail)
                  if (dData.emailId === msg.id) {
                    isDuplicate = true; break;
                  }

                  // 2. Anti-doublon métier (Saisie manuelle existante)
                  const docSupplier = (dData.supplier || dData.category || '').toLowerCase();
                  const docName = (dData.name || '').toLowerCase();
                  const isMatchSupplier = targetSupplierTokens.some((t: string) => docSupplier.includes(t) || docName.includes(t));
                  if (!isMatchSupplier) continue;

                  // --- Le doc existant est-il marqué comme payé ? ---
                  const isMarkedAsPaid = dData.status === 'paid' || !!dData.paymentDate;

                  // a) Vérifier si le montant est environ le même (tolérance élargie à 1 TND)
                  if (parsed.montant) {
                    const docAmountNum = parseFloat(String(dData.amount).replace(/[^\d.,]/g, '').replace(',', '.'));
                    const tolerance = isMarkedAsPaid ? 2.0 : 1.0;
                    if (!isNaN(docAmountNum) && Math.abs(docAmountNum - parsed.montant) < tolerance) {
                      console.log(`[Gmail Cron] Doublon par montant (${docAmountNum} ≈ ${parsed.montant}, payé=${isMarkedAsPaid}) pour ${provider.name}`);
                      isDuplicate = true; break;
                    }
                  }

                  // b) Vérifier si la période textuelle est identique
                  if (parsed.periode && dData.consumptionPeriod && parsed.periode.toLowerCase() === dData.consumptionPeriod.toLowerCase()) {
                    console.log(`[Gmail Cron] Doublon par période textuelle identique: "${parsed.periode}" pour ${provider.name}`);
                    isDuplicate = true; break;
                  }

                  // c) Vérifier par mois/année (fonctionne pour les docs payés ET non payés)
                  const existingDocPeriod = extractMonthYear(dData.consumptionPeriod) || 
                                           extractMonthYear(dData.billingStartDate) ||
                                           extractMonthYear(dData.billingEndDate) ||
                                           extractMonthYear(dData.name) ||
                                           (dData.issueDate && isValid(new Date(dData.issueDate)) ? { month: new Date(dData.issueDate).getMonth(), year: new Date(dData.issueDate).getFullYear() } : null) ||
                                           (dData.paymentDate && isValid(new Date(dData.paymentDate)) ? { month: new Date(dData.paymentDate).getMonth(), year: new Date(dData.paymentDate).getFullYear() } : null);

                  if (gmailPeriod && existingDocPeriod) {
                    if (existingDocPeriod.month === gmailPeriod.month && existingDocPeriod.year === gmailPeriod.year) {
                       console.log(`[Gmail Cron] Doublon par période (${gmailPeriod.month + 1}/${gmailPeriod.year}, payé=${isMarkedAsPaid}) pour ${provider.name}`);
                       isDuplicate = true; break;
                    }
                  }

                  // d) Pour les docs payés : vérification par proximité de date (45 jours)
                  if (isMarkedAsPaid && dateReference && isValid(dateReference)) {
                    const existingDate = dData.issueDate || dData.paymentDate || dData.dueDate || dData.createdAt;
                    if (existingDate) {
                      try {
                        const existDate = new Date(existingDate);
                        if (isValid(existDate)) {
                          const daysDiff = Math.abs(dateReference.getTime() - existDate.getTime()) / (1000 * 60 * 60 * 24);
                          if (daysDiff < 45) {
                            console.log(`[Gmail Cron] Doublon par proximité date (${Math.round(daysDiff)}j, payé) pour ${provider.name}`);
                            isDuplicate = true; break;
                          }
                        }
                      } catch (e) { /* ignore parse error */ }
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tente d'extraire {month, year} (0-indexed month) depuis divers formats de strings */
function extractMonthYear(str?: string | null): { month: number, year: number } | null {
  if (!str) return null;
  
  // Format : "Janvier 2026" ou "janv. 2026"
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const longMonths = ['janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'aout', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre'];
  
  const lowerStr = str.toLowerCase();
  
  // Chercher l'année (4 chiffres)
  const yearMatch = lowerStr.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1]);

  // Chercher le mois
  for (let i = 0; i < longMonths.length; i++) {
    if (lowerStr.includes(longMonths[i])) return { month: i % 12, year };
  }
  for (let i = 0; i < months.length; i++) {
    if (lowerStr.includes(months[i])) return { month: i, year };
  }
  
  // Format : "2026-02"
  const isoMatch = lowerStr.match(/(\d{4})-(\d{2})/);
  if (isoMatch) return { month: parseInt(isoMatch[2]) - 1, year: parseInt(isoMatch[1]) };

  return null;
}

function buildInvoiceName(source: string, periode?: string): string {
  const label = source === 'STEG' ? 'Facture STEG' : 'Facture Orange TN';
  return periode ? `${label} — ${periode}` : `${label} — ${new Date().toLocaleDateString('fr-TN')}`;
}
