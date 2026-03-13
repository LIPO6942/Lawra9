/**
 * Parser STEG — extrait les données de facturation depuis un email STEG
 * Email source : facturemail@steg.com.tn
 */

export interface ParsedInvoice {
  source: 'STEG' | 'ORANGE_TN';
  referenceClient?: string;
  montant?: number;
  devise: 'TND';
  dateFacture?: string;   // ISO date string
  dateEcheance?: string;  // ISO date string
  periode?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;    // URL to view the invoice online
  rawText: string;
}

/**
 * Parse le corps texte/HTML d'un email STEG
 * et tente d'en extraire les champs clés
 */
export function parseStegEmail(textBody: string, htmlBody: string): ParsedInvoice {
  // On utilise le texte brut si dispo, sinon on nettoie le HTML
  const raw = textBody || stripHtml(htmlBody);

  const result: ParsedInvoice = {
    source: 'STEG',
    devise: 'TND',
    rawText: raw.slice(0, 1000), // Garder un extrait pour debug
  };

  // ── Montant total en TND ──────────────────────────────────────────────────
  // Exemples : "87,500 TND", "87.500 DT", "Montant à payer : 87,500"
  const montantMatch =
    raw.match(/(?:montant[^:]*:|total[^:]*:)\s*([\d\s,.]+)\s*(?:TND|DT|dinars?)/i) ||
    raw.match(/([\d]+[.,][\d]{3})\s*(?:TND|DT)/i) ||
    raw.match(/(?:payer|r[eè]gler)[^\d]*([\d]+[.,][\d]{3})/i);
  if (montantMatch) {
    result.montant = parseAmount(montantMatch[1]);
  }

  // ── Référence abonné / compteur ──────────────────────────────────────────
  // Exemples : "N° Abonné : 12345678", "Référence : 201-...", "Contrat : 12345"
  const refMatch =
    raw.match(/n[°o]?\s*(?:abonn[eé]|contrat|client|compteur)[^:]*:\s*([0-9A-Z\-]+)/i) ||
    raw.match(/r[eé]f[eé]rence[^:]*:\s*([0-9A-Z\-]{5,})/i);
  if (refMatch) {
    result.referenceClient = refMatch[1].trim();
  }

  // ── Numéro de facture ────────────────────────────────────────────────────
  const invoiceMatch =
    raw.match(/n[°o]?\s*(?:facture|fact\.?)[^:]*:\s*([0-9A-Z\-\/]+)/i) ||
    raw.match(/facture\s+n[°o]?\s*([0-9A-Z\-\/]+)/i);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1].trim();
  }

  // ── Période de facturation ───────────────────────────────────────────────
  // Exemples : "Période : Février 2026", "Consommation du 01/01 au 28/02/2026"
  const MOIS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
  const periodeMatch =
    raw.match(new RegExp(`((?:${MOIS})\\s+\\d{4})`, 'i')) ||
    raw.match(/p[eé]riode[^:]*:\s*(.{5,40})/i);
  if (periodeMatch) {
    result.periode = periodeMatch[1].trim();
  }

  // ── Date d'émission de la facture ───────────────────────────────────────
  // Exemples : "Date facture : 01/03/2026", "Émise le 01-03-2026"
  const dateFactureMatch =
    raw.match(/(?:date\s*(?:de\s*)?facture|[eé]mise?\s*le)[^:]*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
  if (dateFactureMatch) {
    result.dateFacture = parseTunisianDate(dateFactureMatch[1]);
  }

  // ── Date d'échéance / limite de paiement ───────────────────────────────
  // Exemples : "Date limite : 31/03/2026", "Avant le 31-03-2026", "Échéance : 31/03/2026"
  const echeanceMatch =
    raw.match(/(?:date\s*limite|[eé]ch[eé]ance|avant\s*le|payer\s*avant)[^:]*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i) ||
    raw.match(/limite[^:]*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
  if (echeanceMatch) {
    result.dateEcheance = parseTunisianDate(echeanceMatch[1]);
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Nettoyer balises HTML pour obtenir du texte brut */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convertir "87,500" ou "87.500" → 87.500 (float) */
function parseAmount(raw: string): number {
  // Format tunisien : virgule = séparateur décimal, point ou espace = milliers
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

/** Convertir "31/03/2026" → "2026-03-31" (ISO) */
function parseTunisianDate(raw: string): string {
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return raw;
}
