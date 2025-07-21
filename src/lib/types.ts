
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
  file?: File | Blob; // Store the file object itself
  fileUrl?: string; // Temporary URL for display, generated from file object
  subCategory?: string; // For 'Maison' section categories like 'Contrat acquisition'
};

export type DocumentWithFile = Omit<Document, 'id' | 'createdAt' | 'fileUrl'> & {
  file?: File | Blob;
}

export type Alert = {
  id: string;
  documentId: string;
  documentName: string;
  dueDate: string; // ISO date string
  type: 'Paiement' | 'Expiration' | 'Renouvellement';
};
