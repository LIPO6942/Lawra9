
export type SubFile = {
  id: string; // Can be a timestamp or a random string
  name: string;
  file: File | Blob;
};

export type Document = {
  id: string;
  name: string;
  category: 'STEG' | 'SONEDE' | 'Reçu Bancaire' | 'Maison' | 'Internet' | 'Assurance' | 'Contrat' | 'Autre';
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
  notes?: string; // Free text notes
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
