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
              console.log(`[Gmail Sync] Facture payée ignorée pour l'email ${msg.id}`);
              results.skipped++;
              continue;
            }

            // ── Anti-doublon technique et métier ───────────────────────────
            let isDuplicate = false;
            const targetSupplierTokens = provider.name === 'STEG' ? ['steg'] : ['orange', 'otn'];
            const targetCategory = provider.category.toLowerCase(); // 'steg' ou 'internet'
            
            // Trouver la date de référence pour comparer le mois
            let dateReference: Date | null = null;
            if (parsed.dateFacture) dateReference = parseISO(parsed.dateFacture);
            else if (parsed.dateEcheance) dateReference = parseISO(parsed.dateEcheance);
            else dateReference = new Date(parseInt(fullMsg.internalDate));

            // Période de la facture Gmail (extraite de la période parsée OU de la date de référence)
            const gmailPeriod = extractMonthYear(parsed.periode) || 
                               (dateReference && isValid(dateReference) ? { month: dateReference.getMonth(), year: dateReference.getFullYear() } : null);

            for (const dData of recentDocs) {
              // 1. Anti-doublon technique (déjà importé par Gmail)
              if (dData.emailId === msg.id) {
                isDuplicate = true; break;
              }

              // 2. Vérifier si c'est le même fournisseur/catégorie
              const docSupplier = (dData.supplier || '').toLowerCase();
              const docCategory = (dData.category || '').toLowerCase();
              const docName = (dData.name || '').toLowerCase();
              const isMatchSupplier = 
                targetSupplierTokens.some(t => docSupplier.includes(t) || docName.includes(t)) ||
                docCategory === targetCategory;
              if (!isMatchSupplier) continue;

              // --- Le doc existant est-il marqué comme payé ? ---
              const isMarkedAsPaid = dData.status === 'paid' || !!dData.paymentDate;

              // ══════════════════════════════════════════════════════════════
              // a) Vérifier si le montant est environ le même
              // ══════════════════════════════════════════════════════════════
              if (parsed.montant) {
                const docAmountNum = parseFloat(String(dData.amount).replace(/[^\d.,]/g, '').replace(',', '.'));
                const tolerance = isMarkedAsPaid ? 2.0 : 1.0;
                if (!isNaN(docAmountNum) && Math.abs(docAmountNum - parsed.montant) < tolerance) {
                  console.log(`[Gmail Sync] Doublon par montant (${docAmountNum} ≈ ${parsed.montant}, payé=${isMarkedAsPaid}) pour ${provider.name}`);
                  isDuplicate = true; break;
                }
              }

              // ══════════════════════════════════════════════════════════════
              // b) Vérifier si la période textuelle est identique
              // ══════════════════════════════════════════════════════════════
              if (parsed.periode && dData.consumptionPeriod && parsed.periode.toLowerCase() === dData.consumptionPeriod.toLowerCase()) {
                console.log(`[Gmail Sync] Doublon par période textuelle identique: "${parsed.periode}" pour ${provider.name}`);
                isDuplicate = true; break;
              }

              // ══════════════════════════════════════════════════════════════
              // c) Vérifier par mois/année de facturation
              //    (NE PAS utiliser paymentDate ici — c'est la date de paiement,
              //     pas la période de facturation)
              // ══════════════════════════════════════════════════════════════
              // Période explicite (saisie manuellement ou trouvée)
              let existingDocPeriod = extractMonthYear(dData.consumptionPeriod) || 
                                       extractMonthYear(dData.billingStartDate) ||
                                       extractMonthYear(dData.billingEndDate) ||
                                       extractMonthYear(dData.name) ||
                                       (dData.issueDate && isValid(new Date(dData.issueDate)) ? { month: new Date(dData.issueDate).getMonth(), year: new Date(dData.issueDate).getFullYear() } : null) ||
                                       (dData.dueDate && isValid(new Date(dData.dueDate)) ? { month: new Date(dData.dueDate).getMonth(), year: new Date(dData.dueDate).getFullYear() } : null);

              // ── Logique "période déduite" pour les docs manuels ─────────
              // Généralement, on paie/saisit une facture Orange le mois suivant
              // Ex: payé le 01 mars -> conso février (mois - 1)
              if (!existingDocPeriod) {
                const actionDateStr = dData.paymentDate || dData.createdAt;
                if (actionDateStr) {
                  const actionDate = new Date(actionDateStr);
                  if (isValid(actionDate)) {
                    const m = actionDate.getMonth();
                    const y = actionDate.getFullYear();
                    existingDocPeriod = {
                      month: m === 0 ? 11 : m - 1,
                      year: m === 0 ? y - 1 : y
                    };
                    console.log(`[Gmail Sync] Période déduite (mois précédent) pour le doc ${dData.id}: ${existingDocPeriod.month + 1}/${existingDocPeriod.year}`);
                  }
                }
              }
              if (gmailPeriod && existingDocPeriod) {
                if (existingDocPeriod.month === gmailPeriod.month && existingDocPeriod.year === gmailPeriod.year) {
                   console.log(`[Gmail Sync] Doublon par période (${gmailPeriod.month + 1}/${gmailPeriod.year}, payé=${isMarkedAsPaid}) pour ${provider.name}`);
                   isDuplicate = true; break;
                }
              }

              // ══════════════════════════════════════════════════════════════
              // d) LOGIQUE CLÉ pour les docs PAYÉS :
              //    Si un document PAYÉ du même fournisseur existe, BLOQUER
              //    l'import SAUF si on peut PROUVER que les périodes sont
              //    différentes.
              //    
              //    Pourquoi : les documents manuels n'ont souvent aucune
              //    info de période (pas de consumptionPeriod, billingStart, 
              //    etc). Dans ce cas, on préfère NE PAS importer plutôt
              //    que créer un doublon.
              // ══════════════════════════════════════════════════════════════
              if (isMarkedAsPaid) {
                // Si le doc existant N'A PAS de période extractible,
                // on ne peut pas prouver qu'il est pour un mois différent
                // → on bloque par précaution
                if (!existingDocPeriod) {
                  console.log(`[Gmail Sync] Doc payé sans période trouvé pour ${provider.name} — blocage par précaution (doc: ${dData.id})`);
                  isDuplicate = true; break;
                }
                
                // Si le doc existant A une période mais la facture Gmail 
                // aussi, et les périodes SONT différentes, c'est OK → 
                // on continue (pas de blocage). 
                // Si les périodes sont identiques → déjà bloqué en (c).
                // Donc ici on ne fait rien de plus si existingDocPeriod existe.
              }

              if (isDuplicate) break;
            }

            if (isDuplicate) {
              console.log(`[Gmail Sync] Doublon détecté pour l'email ${msg.id}`);
              results.skipped++;
              continue;
            }

            // Construire le document Lawra9 (compatible avec le type Document existant)
            // ── Lien Gmail direct comme fallback universel ──────────────────
            const gmailDirectLink = `https://mail.google.com/mail/u/0/#inbox/${msg.id}`;
            
            let notesText = `Importé automatiquement depuis Gmail.`;
            if (parsed.invoiceUrl) {
              notesText = `📎 [Consulter la facture en ligne](${parsed.invoiceUrl})\n\n${notesText}`;
            }
            // Toujours ajouter le lien Gmail direct
            notesText += `\n📧 [Voir l'email original dans Gmail](${gmailDirectLink})`;
            notesText += `\n\nExtrait : ${parsed.rawText.slice(0, 200)}`;

            // ── 4c. Gérer les pièces jointes PDF ────────────────────────────
            const pdfInfos = findPdfAttachments(fullMsg.payload);
            let fileBase64Content: string | null = null;
            let fileName: string | null = null;

            if (pdfInfos.length > 0) {
              try {
                const attachment = await getGmailAttachment(accessToken, msg.id, pdfInfos[0].attachmentId);
                // Firestore a une limite de ~1MB par document
                // Un base64 de 900KB = ~675KB de PDF original
                const base64SizeKB = (attachment.length * 3) / 4 / 1024;
                if (base64SizeKB < 900) {
                  fileBase64Content = attachment;
                  fileName = pdfInfos[0].filename;
                } else {
                  console.log(`[Gmail Sync] PDF trop volumineux (${Math.round(base64SizeKB)}KB) pour Firestore, stockage du lien uniquement`);
                  // Ajouter un lien vers le PDF en pièce jointe via Gmail
                  if (!parsed.invoiceUrl) {
                    notesText = `📎 [Ouvrir l'email pour accéder au PDF](${gmailDirectLink})\n\n${notesText}`;
                  }
                }
              } catch (attachErr: any) {
                console.error(`[Gmail Sync] Erreur téléchargement pièce jointe:`, attachErr.message);
              }
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
              invoiceUrl: parsed.invoiceUrl || gmailDirectLink, // Toujours un lien
              status: 'pending' as const,
              autoImported: true,
              importedAt: FieldValue.serverTimestamp(),
              createdAt: new Date(parseInt(fullMsg.internalDate)).toISOString(),
              notes: notesText,
              fileBase64: fileBase64Content,
              fileName: fileName
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
