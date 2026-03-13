/**
 * Parser Orange Tunisie — extrait les données de facturation
 * Email source : factures.otn@orange.com
 */

import { ParsedInvoice } from './steg';

/**
 * Parse le corps texte/HTML d'un email Orange Tunisie
 */
export function parseOrangeEmail(textBody: string, htmlBody: string): ParsedInvoice {
  const raw = textBody || stripHtml(htmlBody);

  const result: ParsedInvoice = {
    source: 'ORANGE_TN',
    devise: 'TND',
    rawText: raw.slice(0, 1000),
  };

  // ── Montant à payer ──────────────────────────────────────────────────────
  // Orange TN : "Montant à payer : 45,000 TND", "Total : 45.000 DT"
  // Peut aussi apparaitre comme "45,000 TND" ou "45 000 DT" dans une ligne isolée
  const montantMatch =
    raw.match(/(?:montant[^:]*[àa][^:]*payer|total\s+(?:à|a)\s+payer|total\s+factur[eé])[^:]*:\s*([\d\s,.]+)\s*(?:TND|DT|dinars?)/i) ||
    raw.match(/(?:montant|total)[^:]*:\s*([\d]+[.,][\d]{3})\s*(?:TND|DT)/i) ||
    raw.match(/([\d]+[.,][\d]{3})\s*(?:TND|DT)/i);
  if (montantMatch) {
    result.montant = parseAmount(montantMatch[1]);
  }

  // ── Numéro de contrat / ligne ────────────────────────────────────────────
  // "N° Contrat : OTN-123456", "Ligne : 71234567", "Compte : 123456"
  const refMatch =
    raw.match(/n[°o]?\s*(?:contrat|ligne|compte|abonn[eé])[^:]*:\s*([0-9A-Z\-]{4,})/i) ||
    raw.match(/(?:contrat|compte)\s*:\s*([0-9A-Z\-]{4,})/i);
  if (refMatch) {
    result.referenceClient = refMatch[1].trim();
  }

  // ── Numéro de facture ────────────────────────────────────────────────────
  const invoiceMatch =
    raw.match(/n[°o]?\s*(?:facture|fact\.?)[^:]*:\s*([0-9A-Z\-\/]+)/i) ||
    raw.match(/facture\s*n[°o]?\s*([0-9A-Z\-\/]+)/i);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1].trim();
  }

  // ── Période ──────────────────────────────────────────────────────────────
  const MOIS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
  const periodeMatch =
    raw.match(new RegExp(`(?:p[eé]riode|mois|mensualit[eé])[^:]*:\\s*((?:${MOIS})\\s+\\d{4})`, 'i')) ||
    raw.match(new RegExp(`((?:${MOIS})\\s+\\d{4})`, 'i'));
  if (periodeMatch) {
    result.periode = periodeMatch[1].trim();
  }

  // ── Date d'émission ──────────────────────────────────────────────────────
  const dateFactureMatch =
    raw.match(/(?:date\s*(?:de\s*)?(?:facture|facturation)|[eé]tablie?\s*le)[^:]*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
  if (dateFactureMatch) {
    result.dateFacture = parseTunisianDate(dateFactureMatch[1]);
  }

  // ── Date d'échéance ──────────────────────────────────────────────────────
  // "avant le 15/03/2026", "Payer avant : 15-03-2026", "Date limite de paiement"
  const echeanceMatch =
    raw.match(/(?:avant\s*le|date\s*limite|[eé]ch[eé]ance|payer\s*avant)[^:]*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/avant\s*le\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
  if (echeanceMatch) {
    result.dateEcheance = parseTunisianDate(echeanceMatch[1]);
  }

  return result;
}

// ── Helpers (mêmes que steg.ts) ──────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

function parseTunisianDate(raw: string): string {
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return raw;
}
