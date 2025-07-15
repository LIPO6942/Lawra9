
import { Document, Alert } from './types';
import { subDays, addDays } from 'date-fns';

const now = new Date();

// We will keep mock data for now, but the app will primarily use dynamic, AI-analyzed data.
export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'Facture STEG - Janvier 2024',
    category: 'Facture',
    createdAt: subDays(now, 5).toISOString(),
    fileUrl: '/mock/facture-steg.pdf',
    amount: 120.50,
    supplier: 'STEG',
    dueDate: addDays(now, 6).toISOString(),
  },
  {
    id: 'doc-2',
    name: 'Facture SONEDE - Q4 2023',
    category: 'Facture',
    createdAt: subDays(now, 15).toISOString(),
    fileUrl: '/mock/facture-sonede.pdf',
    amount: 75.00,
    supplier: 'SONEDE',
    dueDate: subDays(now, 2).toISOString(),
  },
  {
    id: 'doc-3',
    name: 'Contrat de location - Apt Sahloul',
    category: 'Contrat',
    createdAt: subDays(now, 90).toISOString(),
    fileUrl: '/mock/contrat-location.pdf',
    summary: "Contrat de location pour l'appartement situé à Sahloul, Sousse. Loyer mensuel de 850 TND.",
    dueDate: addDays(now, 35).toISOString(),
  },
  {
    id: 'doc-4',
    name: 'Garantie TV Samsung',
    category: 'Garantie',
    createdAt: subDays(now, 180).toISOString(),
    fileUrl: '/mock/garantie-tv.pdf',
    dueDate: addDays(now, 14).toISOString(),
  },
  {
    id: 'doc-5',
    name: 'Reçu Achat Carrefour',
    category: 'Reçu',
    createdAt: subDays(now, 2).toISOString(),
    fileUrl: '/mock/recu-carrefour.jpg',
    amount: 230.15,
    supplier: 'Carrefour'
  },
   {
    id: 'doc-6',
    name: 'Assurance Auto AMI',
    category: 'Contrat',
    createdAt: subDays(now, 200).toISOString(),
    fileUrl: '/mock/assurance-ami.pdf',
    amount: 750,
    supplier: 'AMI Assurances',
    dueDate: addDays(now, 150).toISOString(),
  },
];

export const mockAlerts: Alert[] = mockDocuments
.filter(doc => !!doc.dueDate)
.map(doc => ({
    id: `alert-${doc.id}`,
    documentId: doc.id,
    documentName: doc.name,
    dueDate: doc.dueDate!,
    type: doc.category === 'Facture' ? 'Paiement' : (doc.category === 'Garantie' ? 'Expiration' : 'Renouvellement'),
}));
