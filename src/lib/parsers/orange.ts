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
  // "Montant à payer 40,9DT" ou "Montant à payer : 40,9 DT"
  const montantMatch =
    raw.match(/(?:montant[^0-9]*payer|total[^0-9]*payer|total[^0-9]*factur[eé])\s*:?\s*([\d\s]+(?:[.,][\d]+)?)\s*(?:TND|DT|dinars?)/i) ||
    raw.match(/(?:montant|total)\s*:?\s*([\d\s]+(?:[.,][\d]+)?)\s*(?:TND|DT)/i) ||
    raw.match(/([\d\s]+(?:[.,][\d]+)?)\s*(?:TND|DT)/i);
  if (montantMatch) {
    result.montant = parseAmount(montantMatch[1]);
  }

  // ── Numéro de contrat / ligne / référence ────────────────────────────────
  // "Référence 2603059885", "N° Contrat : OTN-123456"
  const refMatch =
    raw.match(/(?:r[eé]f[eé]rence|n[°o]?\s*(?:contrat|ligne|compte|abonn[eé])|contrat|compte)[^\d]*([0-9A-Z\-]{6,})/i);
  if (refMatch) {
    result.referenceClient = refMatch[1].trim();
  }

  // ── Numéro de facture ────────────────────────────────────────────────────
  const invoiceMatch =
    raw.match(/n[°o]?\s*(?:facture|fact\.?)[^:]*:?\s*([0-9A-Z\-\/]+)/i) ||
    raw.match(/facture\s*n[°o]?\s*([0-9A-Z\-\/]+)/i);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1].trim();
  }

  // ── Période ──────────────────────────────────────────────────────────────
  const MOIS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
  const periodeMatch =
    raw.match(new RegExp(`(?:p[eé]riode|mois|mensualit[eé])[^:]*:?\\s*((?:${MOIS})\\s+\\d{4})`, 'i')) ||
    raw.match(new RegExp(`((?:${MOIS})\\s+\\d{4})`, 'i'));
  if (periodeMatch) {
    result.periode = periodeMatch[1].trim();
  }

  // ── Date d'émission ──────────────────────────────────────────────────────
  const dateFactureMatch =
    raw.match(/(?:date\s*(?:de\s*)?(?:facture|facturation)|[eé]tablie?\s*le)[^:]*:?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
  if (dateFactureMatch) {
    result.dateFacture = parseTunisianDate(dateFactureMatch[1]);
  }

  // ── Date d'échéance ──────────────────────────────────────────────────────
  // "Date limite de paiement 01/04/2026", "avant le 15/03/2026"
  const echeanceMatch =
    raw.match(/(?:avant\s*le|date\s*limite(?:[^\d]*paiement)?|[eé]ch[eé]ance|payer\s*avant)[^\d]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/avant\s*le\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
  if (echeanceMatch) {
    result.dateEcheance = parseTunisianDate(echeanceMatch[1]);
  }

  // ── Lien de la facture (extrait du HTML) ─────────────────────────────────
  // <a href="https://..." ...>Consulter votre facture</a> ou autres variantes
  if (htmlBody) {
    const urlMatch =
      htmlBody.match(/href="([^"]+)"[^>]*>[^<]*(?:consulter|t[eé]l[eé]charger|voir|acc[eé]der)[^<]*facture/i) ||
      htmlBody.match(/href="([^"]+)"[^>]*>[^<]*facture[^<]*/i) ||
      htmlBody.match(/href="(https?:\/\/[^"]*(?:facture|invoice|bill|orange)[^"]*)"/i) ||
      htmlBody.match(/href="(https?:\/\/[^"]+\.pdf)"/i);
    if (urlMatch) {
      result.invoiceUrl = urlMatch[1];
    }
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
