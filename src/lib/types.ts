
export type SubFile = {
  id: string; // Can be a timestamp or a random string
  name: string;
  file: File | Blob;
};

export type Document = {
  id: string;
  name: string;
  category: 'STEG' | 'SONEDE' | 'Reçu Bancaire' | 'Maison' | 'Internet' | 'Assurance' | 'Contrat' | 'Recus de caisse' | 'Autre';
  createdAt: string; // ISO date string
  amount?: string;
  supplier?: string;
  dueDate?: string; // ISO date string
  issueDate?: string; // ISO date string
  invoiceNumber?: string;
  billingStartDate?: string; // ISO date string
  billingEndDate?: string; // ISO date string
  consumptionPeriod?: string; // For special cases like SONEDE
  consumptionQuantity?: string; // e.g., "150 kWh" or "75 m³"
  gasAmount?: string; // For STEG gas part
  gasConsumptionQuantity?: string; // e.g., "50 m³"
  // File data is stored as Blob
  file?: File | Blob;
  // Multi-file support for Maison
  files?: SubFile[];
  subCategory?: string; // For 'Maison' section categories like 'Contrat acquisition'
  status?: 'pending' | 'paid' | 'expired';
  notes?: string; // Free text notes
  paymentDate?: string; // ISO date string when the bill was actually paid
};

export type DocumentWithFile = Omit<Document, 'id' | 'createdAt'> & {
  file?: File | Blob;
  files?: SubFile[];
}

export type Alert = {
  id: string;
  documentId: string;
  documentName: string;
  dueDate: string; // ISO date string
  type: 'Paiement' | 'Expiration' | 'Renouvellement';
};

// ==========================
// Receipts & Items (MVP)
// ==========================

export type ReceiptLine = {
  id: string;
  rawLabel: string;
  normalizedLabel?: string;
  category?: string; // e.g., Epicerie, Frais, Boissons, etc.
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  vatRate?: number;
  barcode?: string;
  // normalized unit fields
  stdUnit?: 'kg' | 'L' | 'pcs';
  stdQty?: number; // quantity in stdUnit (e.g., 0.5 kg, 1.5 L, 2 pcs)
  standardUnitPrice?: number; // price per stdUnit
};

export type Receipt = {
  id: string;
  storeName?: string;
  storeId?: string;
  purchaseAt?: string; // ISO datetime
  currency?: string; // e.g., TND, EUR
  total?: number;
  subtotal?: number;
  taxTotal?: number;
  ocrText?: string;
  file?: File | Blob; // original image/PDF (client-side IndexedDB)
  status?: 'parsed' | 'needs_review' | 'confirmed';
  confidence?: number; // 0..1
  lines: ReceiptLine[];
};

export type ProductSummary = {
  productKey: string; // normalized label key
  lastPurchasedAt?: string;
  lastUnitPrice?: number;
  lastStoreName?: string;
};
