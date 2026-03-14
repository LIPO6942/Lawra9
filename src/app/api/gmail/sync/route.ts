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
import { format, parseISO, isValid } from 'date-fns';

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

    // Charger les documents récents (anti-doublon métier)
    // On passe à 200 docs pour couvrir une plus large période de saisies manuelles
    const userDocsRef = db.collection('users').doc(userId).collection('documents');
    const recentDocsSnap = await userDocsRef.orderBy('createdAt', 'desc').limit(200).get();
    const recentDocs = recentDocsSnap.docs.map((d: any) => d.data());

    for (const provider of PROVIDERS) {
      try {
        // Chercher les emails récents (120 jours pour être sûr de couvrir les chevauchements)
        const messages = await searchGmailMessages(
          accessToken,
          `${provider.query} newer_than:120d`,
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

            // ── Filtrage par statut de paiement (dans le contenu de l'email) ──
            const searchContent = (text + ' ' + (html || '')).toLowerCase();
            const isAlreadyPaidInEmail = 
              searchContent.includes('facture acquittée') || 
              searchContent.includes('paiement reçu') ||
              searchContent.includes('votre paiement a bien été pris en compte') ||
              searchContent.includes('facture déjà payée') ||
              searchContent.includes('montant payé') ||
              searchContent.includes('solde : 0') ||
              searchContent.includes('solde: 0');

            if (isAlreadyPaidInEmail) {
              console.log(`[Gmail Sync] Facture déjà acquittée dans l'email ${msg.id} -> Skip`);
              results.skipped++;
              continue;
            }

            // ── Anti-doublon métier ─────────────────────────────────────────
            let isDuplicate = false;
            const targetSupplierTokens = provider.name === 'STEG' ? ['steg'] : ['orange', 'otn'];
            const targetCategory = provider.category.toLowerCase();
            
            // Période déduite de la facture Gmail
            let gmailPeriod = extractMonthYear(parsed.periode);
            if (!gmailPeriod) {
              const refDate = parsed.dateFacture ? parseISO(parsed.dateFacture) : new Date(parseInt(fullMsg.internalDate));
              if (isValid(refDate)) {
                // Facture reçue en Mars = Conso Février (M-1)
                const m = refDate.getMonth();
                const y = refDate.getFullYear();
                gmailPeriod = {
                  month: m === 0 ? 11 : m - 1,
                  year: m === 0 ? y - 1 : y
                };
              }
            }

            for (const dData of recentDocs) {
              // 1. Même ID Gmail ?
              if (dData.emailId === msg.id) {
                isDuplicate = true; break;
              }

              // 2. Même fournisseur / catégorie ?
              const docSupplier = (dData.supplier || '').toLowerCase();
              const docCategory = (dData.category || '').toLowerCase();
              const docName = (dData.name || '').toLowerCase();
              const isMatchSupplier = 
                targetSupplierTokens.some(t => docSupplier.includes(t) || docName.includes(t)) ||
                docCategory === targetCategory;
              
              if (!isMatchSupplier) continue;

              const isMarkedAsPaid = dData.status === 'paid' || !!dData.paymentDate;

              // a) Doublon par montant
              if (parsed.montant) {
                const docAmountNum = parseFloat(String(dData.amount).replace(/[^\d.,]/g, '').replace(',', '.'));
                const tolerance = isMarkedAsPaid ? 2.0 : 1.0;
                if (!isNaN(docAmountNum) && Math.abs(docAmountNum - parsed.montant) < tolerance) {
                   console.log(`[Gmail Sync] Doublon par montant proche (${docAmountNum} ≈ ${parsed.montant})`);
                   isDuplicate = true; break;
                }
              }

              // b) Doublon par période
              let existingDocPeriod = extractMonthYear(dData.consumptionPeriod) || 
                                       extractMonthYear(dData.billingStartDate) ||
                                       extractMonthYear(dData.billingEndDate);

              // Si c'est une utilité payée, on préfère déduire la période du paiement (M-1)
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
                existingDocPeriod = extractMonthYear(dData.name) ||
                                    (dData.issueDate && isValid(new Date(dData.issueDate)) ? { month: new Date(dData.issueDate).getMonth(), year: new Date(dData.issueDate).getFullYear() } : null);
              }

              if (gmailPeriod && existingDocPeriod) {
                if (existingDocPeriod.month === gmailPeriod.month && existingDocPeriod.year === gmailPeriod.year) {
                  console.log(`[Gmail Sync] Doublon par période (${gmailPeriod.month+1}/${gmailPeriod.year})`);
                  isDuplicate = true; break;
                }
              }

              // c) Sécurité : si payé mais période inconnue, on bloque si c'est le même fournisseur
              if (isMarkedAsPaid && !existingDocPeriod) {
                console.log(`[Gmail Sync] Doublon probable (Utilité déjà payée sans période explicite)`);
                isDuplicate = true; break;
              }
            }

            if (isDuplicate) {
              results.skipped++;
              continue;
            }

            // ── 4c. Gérer les pièces jointes et la sauvegarde ───────────────
            const gmailDirectLink = `https://mail.google.com/mail/u/0/#inbox/${msg.id}`;
            let notesText = `Importé automatiquement depuis Gmail.`;
            if (parsed.invoiceUrl) notesText = `📎 [Consulter la facture en ligne](${parsed.invoiceUrl})\n\n${notesText}`;
            notesText += `\n📧 [Email original](${gmailDirectLink})\n\nExtrait : ${parsed.rawText.slice(0, 200)}`;

            const pdfInfos = findPdfAttachments(fullMsg.payload);
            let fileBase64Content: string | null = null;
            let fileName: string | null = null;

            if (pdfInfos.length > 0) {
              try {
                const attachment = await getGmailAttachment(accessToken, msg.id, pdfInfos[0].attachmentId);
                const base64SizeKB = (attachment.length * 3) / 4 / 1024;
                if (base64SizeKB < 900) {
                  fileBase64Content = attachment;
                  fileName = pdfInfos[0].filename;
                }
              } catch (e) {}
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
              supplier: provider.name === 'STEG' ? 'STEG' : 'Orange',
              dueDate: parsed.dateEcheance || null,
              issueDate: parsed.dateFacture || null,
              invoiceNumber: parsed.invoiceNumber || null,
              consumptionPeriod: parsed.periode || null,
              invoiceUrl: parsed.invoiceUrl || gmailDirectLink,
              status: 'pending',
              autoImported: true,
              importedAt: FieldValue.serverTimestamp(),
              createdAt: new Date(parseInt(fullMsg.internalDate)).toISOString(),
              notes: notesText,
              fileBase64: fileBase64Content,
              fileName: fileName
            });

            results.imported++;
            results.details.push(`✅ ${provider.name} — ${parsed.montant || '0'} TND`);
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

    await integrationRef.update({ lastSyncAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('[Gmail Sync] Erreur fatale:', error.message);
    return NextResponse.json({ error: 'Erreur serveur', details: error.message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractMonthYear(str?: string | null): { month: number, year: number } | null {
  if (!str) return null;
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const longMonths = ['janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'aout', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre'];
  const lowerStr = str.toLowerCase();
  const yearMatch = lowerStr.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1]);
  for (let i = 0; i < longMonths.length; i++) {
    if (lowerStr.includes(longMonths[i])) return { month: i % 12, year };
  }
  for (let i = 0; i < months.length; i++) {
    if (lowerStr.includes(months[i])) return { month: i, year };
  }
  const isoMatch = lowerStr.match(/(\d{4})-(\d{2})/);
  if (isoMatch) return { month: parseInt(isoMatch[2]) - 1, year: parseInt(isoMatch[1]) };
  return null;
}

function buildInvoiceName(source: string, periode?: string): string {
  const label = source === 'STEG' ? 'Facture STEG' : 'Facture Orange TN';
  return periode ? `${label} — ${periode}` : `${label} — ${new Date().toLocaleDateString('fr-TN')}`;
}
