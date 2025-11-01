import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Receipt, ReceiptLine } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// -------------------------------
// Product normalization helpers
// -------------------------------

export function normalizeProductKey(label: string): string {
  return (label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(kg|g|l|litre|litres|piece|pcs|pack|promo|offre|tva|ttc|ht)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ProductPurchase = {
  productKey: string;
  rawLabel: string;
  normalizedLabel?: string;
  purchaseAt?: string;
  storeName?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  currency?: string;
};

export function flattenPurchasesFromReceipts(receipts: Receipt[]): ProductPurchase[] {
  const out: ProductPurchase[] = [];
  for (const rcpt of receipts) {
    const currency = rcpt.currency;
    for (const line of (rcpt.lines || [])) {
      const label = line.normalizedLabel || line.rawLabel || '';
      const productKey = normalizeProductKey(label);
      if (!productKey) continue;
      const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
      out.push({
        productKey,
        rawLabel: line.rawLabel,
        normalizedLabel: line.normalizedLabel,
        purchaseAt: rcpt.purchaseAt,
        storeName: rcpt.storeName,
        quantity: qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        currency,
      });
    }
  }
  return out;
}

export function computeLastPurchaseByProduct(purchases: ProductPurchase[]) {
  // Returns a map productKey -> { lastPurchasedAt, lastUnitPrice, lastStoreName }
  const last: Record<string, { lastPurchasedAt?: string; lastUnitPrice?: number; lastStoreName?: string; }> = {};
  for (const p of purchases) {
    const prev = last[p.productKey];
    const currentTime = p.purchaseAt ? new Date(p.purchaseAt).getTime() : 0;
    const prevTime = prev?.lastPurchasedAt ? new Date(prev.lastPurchasedAt).getTime() : -1;
    if (!prev || currentTime > prevTime) {
      last[p.productKey] = {
        lastPurchasedAt: p.purchaseAt,
        lastUnitPrice: p.unitPrice ?? (p.lineTotal && p.quantity ? p.lineTotal / p.quantity : undefined),
        lastStoreName: p.storeName,
      };
    }
  }
  return last;
}

export function groupHistoryByProduct(purchases: ProductPurchase[]) {
  const byProd: Record<string, ProductPurchase[]> = {};
  for (const p of purchases) {
    if (!byProd[p.productKey]) byProd[p.productKey] = [];
    byProd[p.productKey].push(p);
  }
  // sort each history by date desc
  for (const key of Object.keys(byProd)) {
    byProd[key].sort((a, b) => (new Date(b.purchaseAt || 0).getTime()) - (new Date(a.purchaseAt || 0).getTime()));
  }
  return byProd;
}

// -------------------------------
// Category mapping heuristics
// -------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Frais': ['lait', 'yaourt', 'fromage', 'beurre', 'oeuf', 'crème'],
  'Boucherie': ['viande', 'poulet', 'dinde', 'boeuf', 'steak', 'escalope', 'hache'],
  'Poisson': ['poisson', 'thon', 'saumon', 'sardine'],
  'Boulangerie': ['pain', 'baguette', 'croissant', 'pâtisserie', 'brioche'],
  'Boissons': ['eau', 'jus', 'soda', 'cola', 'boisson', 'thé', 'café'],
  'Hygiène': ['shampoo', 'gel', 'savon', 'dentifrice', 'coton', 'couches'],
  'Entretien': ['lessive', 'détergent', 'eponge', 'essuie', 'javel', 'nettoyant'],
  'Bébé': ['bébé', 'biberon', 'lingette'],
  'Animaux': ['chien', 'chat', 'croquette', 'litière'],
  'Maison': ['ustensile', 'vaisselle', 'bougie', 'batterie', 'piles'],
  'Électronique': ['câble', 'chargeur', 'usb', 'écouteur'],
  'Epicerie': ['pâtes', 'riz', 'huile', 'sucre', 'sel', 'farine', 'conserve', 'harissa', 'tomate'],
};

export function mapCategoryHeuristic(label: string): string {
  const text = (label || '').toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => text.includes(w))) return cat;
  }
  return 'Autres';
}

// -------------------------------
// Unit normalization
// -------------------------------

export type NormalizedUnit = { stdUnit: 'kg' | 'L' | 'pcs'; stdQty: number };

export function normalizeUnit(quantity?: number, unit?: string, label?: string): NormalizedUnit {
  // Try explicit fields first
  if (quantity && unit) {
    const u = unit.toLowerCase();
    if (u === 'kg') return { stdUnit: 'kg', stdQty: quantity };
    if (u === 'g' || u === 'gr') return { stdUnit: 'kg', stdQty: quantity / 1000 };
    if (u === 'l' || u === 'lt') return { stdUnit: 'L', stdQty: quantity };
    if (u === 'ml') return { stdUnit: 'L', stdQty: quantity / 1000 };
    if (u === 'pcs' || u === 'piece' || u === 'pièce' || u === 'un' || u === 'u') return { stdUnit: 'pcs', stdQty: quantity };
  }
  // Parse from label (e.g., 500g, 1kg, 1.5l, x2)
  const text = (label || '').toLowerCase().replace(',', '.');
  const kg = text.match(/(\d+(?:\.\d+)?)\s?kg/);
  if (kg) return { stdUnit: 'kg', stdQty: parseFloat(kg[1]) };
  const g = text.match(/(\d+(?:\.\d+)?)\s?g(?!r)/);
  if (g) return { stdUnit: 'kg', stdQty: parseFloat(g[1]) / 1000 };
  const l = text.match(/(\d+(?:\.\d+)?)\s?l(?!t)/);
  if (l) return { stdUnit: 'L', stdQty: parseFloat(l[1]) };
  const ml = text.match(/(\d+(?:\.\d+)?)\s?ml/);
  if (ml) return { stdUnit: 'L', stdQty: parseFloat(ml[1]) / 1000 };
  const pcs = text.match(/x\s?(\d+)/);
  if (pcs) return { stdUnit: 'pcs', stdQty: parseInt(pcs[1]) };
  // default
  return { stdUnit: 'pcs', stdQty: quantity && quantity > 0 ? quantity : 1 };
}

export function computeStandardUnitPrice(line: ReceiptLine): number | undefined {
  const qty = line.stdQty && line.stdQty > 0 ? line.stdQty : undefined;
  if (!qty) return undefined;
  const unitPrice = line.unitPrice ?? (line.lineTotal && line.quantity ? line.lineTotal / line.quantity : undefined);
  if (unitPrice == null) return undefined;
  // unitPrice is price per (unit). If unit is per piece while stdQty is kg/L, we already normalized qty accordingly
  // For simplicity, consider unitPrice refers to 1 unit of (quantity), and standardUnitPrice scales to stdQty
  // We need price per stdUnit -> if original is per piece with stdQty=1, price per pcs. If label had kg or L, stdQty reflects that.
  // When original had per-line total only, we fallback via lineTotal/quantity then use stdQty.
  return line.lineTotal != null ? (line.lineTotal / (qty)) : (unitPrice / (qty));
}

// -------------------------------
// Receipt-level KPIs & aggregations
// -------------------------------

export function computeKpis(receipts: Receipt[]) {
  const countReceipts = receipts.length;
  const countItems = receipts.reduce((acc, r) => acc + (r.lines?.length || 0), 0);
  const totalSpend = receipts.reduce((acc, r) => acc + (r.total || 0), 0);
  const avgBasket = countReceipts > 0 ? totalSpend / countReceipts : 0;
  return { countReceipts, countItems, totalSpend, avgBasket };
}

export function spendByCategory(receipts: Receipt[]) {
  const map: Record<string, number> = {};
  for (const r of receipts) {
    for (const l of (r.lines || [])) {
      const cat = l.category || mapCategoryHeuristic(l.normalizedLabel || l.rawLabel || '');
      const val = l.lineTotal ?? (l.unitPrice && l.quantity ? l.unitPrice * l.quantity : 0) ?? 0;
      map[cat] = (map[cat] || 0) + (val || 0);
    }
  }
  return map;
}

export function spendByStore(receipts: Receipt[]) {
  const map: Record<string, number> = {};
  for (const r of receipts) {
    const key = r.storeName || 'Inconnu';
    map[key] = (map[key] || 0) + (r.total || 0);
  }
  return map;
}

export function monthlyTrend(receipts: Receipt[]) {
  // returns array of { month: 'YYYY-MM', total }
  const map: Record<string, number> = {};
  for (const r of receipts) {
    const d = r.purchaseAt ? new Date(r.purchaseAt) : null;
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    map[key] = (map[key] || 0) + (r.total || 0);
  }
  return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,total])=>({ month, total }));
}
