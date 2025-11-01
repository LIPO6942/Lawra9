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
