import { Document, Alert } from './types';
import { subDays, addDays } from 'date-fns';

const now = new Date();

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'Facture STEG - Janvier 2024',
    category: 'Facture',
    createdAt: subDays(now, 5).toISOString(),
    fileUrl: '/mock/facture-steg.pdf',
    amount: 120.50,
    supplier: 'STEG',
  },
  {
    id: 'doc-2',
    name: 'Facture SONEDE - Q4 2023',
    category: 'Facture',
    createdAt: subDays(now, 15).toISOString(),
    fileUrl: '/mock/facture-sonede.pdf',
    amount: 75.00,
    supplier: 'SONEDE',
  },
  {
    id: 'doc-3',
    name: 'Contrat de location - Apt Sahloul',
    category: 'Contrat',
    createdAt: subDays(now, 90).toISOString(),
    fileUrl: '/mock/contrat-location.pdf',
    summary: "Contrat de location pour l'appartement situé à Sahloul, Sousse. Loyer mensuel de 850 TND."
  },
  {
    id: 'doc-4',
    name: 'Garantie TV Samsung',
    category: 'Garantie',
    createdAt: subDays(now, 180).toISOString(),
    fileUrl: '/mock/garantie-tv.pdf',
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
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    documentId: 'doc-1',
    documentName: 'Facture STEG - Janvier 2024',
    dueDate: addDays(now, 6).toISOString(),
    type: 'Paiement',
  },
  {
    id: 'alert-2',
    documentId: 'doc-4',
    documentName: 'Garantie TV Samsung',
    dueDate: addDays(now, 14).toISOString(),
    type: 'Expiration',
  },
  {
    id: 'alert-3',
    documentId: 'doc-3',
    documentName: 'Contrat de location - Apt Sahloul',
    dueDate: addDays(now, 35).toISOString(),
    type: 'Renouvellement',
  },
  {
    id: 'alert-4',
    documentId: 'doc-2',
    documentName: 'Facture SONEDE - Q4 2023',
    dueDate: subDays(now, 2).toISOString(), // Expired
    type: 'Paiement',
  },
];
