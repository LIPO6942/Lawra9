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
import { parseISO, isValid } from 'date-fns';

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
  },
  {
    name: 'ORANGE_TN' as const,
    query: 'from:factures.otn@orange.com',
    parser: parseOrangeEmail,
    category: 'Internet' as const,
  },
];

export async function GET(request: Request) {
  // ── Vérification du secret CRON ──
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  const stats = { usersProcessed: 0, totalImported: 0, totalSkipped: 0, totalErrors: 0 };

  try {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      try {
        const integrationSnap = await db
          .collection('users').doc(userId)
          .collection('integrations').doc('gmail')
          .get();

        if (!integrationSnap.exists || integrationSnap.data()?.status !== 'active') {
          continue;
        }

        stats.usersProcessed++;
        let { accessToken, refreshToken, expiresAt } = integrationSnap.data()!;

        // Refresh token if needed
        const isExpired = new Date(expiresAt) <= new Date(Date.now() + 60_000);
        if (isExpired) {
          try {
            const refreshed = await refreshAccessToken(refreshToken);
            accessToken = refreshed.access_token;
            await integrationSnap.ref.update({
              accessToken,
              expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            });
          } catch (e) {
             await integrationSnap.ref.update({ status: 'expired' });
             continue;
          }
        }
        
        const userDocsRef = db.collection('users').doc(userId).collection('documents');
        const recentDocsSnap = await userDocsRef.orderBy('createdAt', 'desc').limit(200).get();
        const recentDocs = recentDocsSnap.docs.map((d: any) => d.data());

        for (const provider of PROVIDERS) {
          try {
            // Uniquement les emails des 7 derniers jours pour le cron
            const messages = await searchGmailMessages(accessToken, `${provider.query} newer_than:7d`, 5);

            for (const msg of messages) {
              try {
                const fullMsg = await getGmailMessage(accessToken, msg.id);
                const { text, html } = extractEmailBody(fullMsg.payload);
                const parsed = provider.parser(text, html);

                // Anti-doublon par contenu ("acquittée")
                const searchContent = (text + ' ' + (html || '')).toLowerCase();
                if (searchContent.includes('facture acquittée') || searchContent.includes('paiement reçu') || searchContent.includes('solde : 0')) {
                   stats.totalSkipped++; continue;
                }

                // Anti-doublon métier
                let isDuplicate = false;
                const targetSupplierTokens = provider.name === 'STEG' ? ['steg'] : ['orange', 'otn'];
                
                let gmailPeriod = extractMonthYear(parsed.periode);
                if (!gmailPeriod) {
                  const refDate = parsed.dateFacture ? parseISO(parsed.dateFacture) : new Date(parseInt(fullMsg.internalDate));
                  if (isValid(refDate)) {
                    const m = refDate.getMonth();
                    const y = refDate.getFullYear();
                    gmailPeriod = { month: m === 0 ? 11 : m - 1, year: m === 0 ? y - 1 : y };
                  }
                }

                for (const dData of recentDocs) {
                  if (dData.emailId === msg.id) { isDuplicate = true; break; }

                  const docSupplier = (dData.supplier || '').toLowerCase();
                  const docName = (dData.name || '').toLowerCase();
                  const isMatchSupplier = targetSupplierTokens.some(t => docSupplier.includes(t) || docName.includes(t)) || dData.category?.toLowerCase() === provider.category.toLowerCase();
                  
                  if (!isMatchSupplier) continue;

                  const isMarkedAsPaid = dData.status === 'paid' || !!dData.paymentDate;

                  // Montant
                  if (parsed.montant) {
                    const docAmountNum = parseFloat(String(dData.amount).replace(/[^\d.,]/g, '').replace(',', '.'));
                    const tolerance = isMarkedAsPaid ? 2.0 : 1.0;
                    if (!isNaN(docAmountNum) && Math.abs(docAmountNum - parsed.montant) < tolerance) { isDuplicate = true; break; }
                  }

                  // Période
                  let existingDocPeriod = extractMonthYear(dData.consumptionPeriod) || extractMonthYear(dData.billingStartDate) || extractMonthYear(dData.billingEndDate);

                  const isUtility = provider.name === 'STEG' || provider.name === 'ORANGE_TN';
                  if (isMarkedAsPaid && isUtility && !dData.consumptionPeriod) {
                    const actionDateStr = dData.paymentDate || dData.createdAt;
                    if (actionDateStr) {
                      const actionDate = new Date(actionDateStr);
                      if (isValid(actionDate)) {
                        const m = actionDate.getMonth();
                        const y = actionDate.getFullYear();
                        existingDocPeriod = { month: m === 0 ? 11 : m - 1, year: m === 0 ? y - 1 : y };
                      }
                    }
                  }

                  if (!existingDocPeriod) {
                    existingDocPeriod = extractMonthYear(dData.name) || (dData.issueDate && isValid(new Date(dData.issueDate)) ? { month: new Date(dData.issueDate).getMonth(), year: new Date(dData.issueDate).getFullYear() } : null);
                  }

                  if (gmailPeriod && existingDocPeriod) {
                    if (existingDocPeriod.month === gmailPeriod.month && existingDocPeriod.year === gmailPeriod.year) {
                      isDuplicate = true; break;
                    }
                  }

                  if (isMarkedAsPaid && !existingDocPeriod) { isDuplicate = true; break; }
                }

                if (isDuplicate) { stats.totalSkipped++; continue; }

                // Save
                const gmailDirectLink = `https://mail.google.com/mail/u/0/#inbox/${msg.id}`;
                const docId = `gmail-${msg.id}`;
                await userDocsRef.doc(docId).set({
                  id: docId,
                  userId,
                  emailId: msg.id,
                  name: buildInvoiceName(provider.name, parsed.periode),
                  category: provider.category,
                  source: provider.name,
                  amount: parsed.montant ? `${parsed.montant.toFixed(3)} TND` : undefined,
                  supplier: provider.name === 'STEG' ? 'STEG' : 'Orange',
                  invoiceUrl: parsed.invoiceUrl || gmailDirectLink,
                  status: 'pending',
                  autoImported: true,
                  importedAt: FieldValue.serverTimestamp(),
                  createdAt: new Date(parseInt(fullMsg.internalDate)).toISOString(),
                  notes: `Importé via cron quotidien.\n\n${parsed.rawText.slice(0, 200)}`
                });

                stats.totalImported++;
              } catch (e) {}
            }
          } catch (e) {}
        }

        await integrationSnap.ref.update({ lastSyncAt: FieldValue.serverTimestamp() });

      } catch (e) {
        stats.totalErrors++;
      }
    }

    return NextResponse.json({ success: true, ...stats });
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}

// Helpers
function extractMonthYear(str?: string | null): { month: number, year: number } | null {
  if (!str) return null;
  const longMonths = ['janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'aout', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre'];
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const lowerStr = str.toLowerCase();
  const yearMatch = lowerStr.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1]);
  for (let i = 0; i < longMonths.length; i++) if (lowerStr.includes(longMonths[i])) return { month: i % 12, year };
  for (let i = 0; i < months.length; i++) if (lowerStr.includes(months[i])) return { month: i, year };
  const isoMatch = lowerStr.match(/(\d{4})-(\d{2})/);
  if (isoMatch) return { month: parseInt(isoMatch[2]) - 1, year: parseInt(isoMatch[1]) };
  return null;
}

function buildInvoiceName(source: string, periode?: string): string {
  const label = source === 'STEG' ? 'Facture STEG' : 'Facture Orange TN';
  return periode ? `${label} — ${periode}` : `${label} — ${new Date().toLocaleDateString('fr-TN')}`;
}
