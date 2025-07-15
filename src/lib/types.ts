
export type Document = {
  id: string;
  name: string;
  category: 'STEG' | 'SONEDE' | 'Reçu Bancaire' | 'Maison' | 'Autre';
  createdAt: string; // ISO date string
  summary?: string;
  fileUrl: string;
  amount?: number;
  supplier?: string;
  dueDate?: string; // ISO date string
  billingStartDate?: string; // ISO date string
  billingEndDate?: string; // ISO date string
};

export type Alert = {
  id: string;
  documentId: string;
  documentName: string;
  dueDate: string; // ISO date string
  type: 'Paiement' | 'Expiration' | 'Renouvellement';
};
