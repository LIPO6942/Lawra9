
import { Document, Alert } from './types';
import { subDays, addDays, startOfMonth, endOfMonth } from 'date-fns';

const now = new Date();

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'Facture STEG - Janvier 2024',
    category: 'STEG',
    createdAt: subDays(now, 65).toISOString(),
    fileUrl: '/mock/facture-steg.pdf',
    amount: "120,50",
    supplier: 'STEG',
    dueDate: addDays(now, 6).toISOString(),
    billingStartDate: startOfMonth(subDays(now, 65)).toISOString(),
    billingEndDate: endOfMonth(subDays(now, 65)).toISOString(),
  },
  {
    id: 'doc-2',
    name: 'Facture SONEDE - Q4 2023',
    category: 'SONEDE',
    createdAt: subDays(now, 75).toISOString(),
    fileUrl: '/mock/facture-sonede.pdf',
    amount: "75,00",
    supplier: 'SONEDE',
    dueDate: subDays(now, 2).toISOString(),
    billingStartDate: subDays(now, 105).toISOString(),
    billingEndDate: subDays(now, 75).toISOString(),
  },
   {
    id: 'doc-7',
    name: 'Facture Orange - Fev 2024',
    category: 'Autre',
    createdAt: subDays(now, 40).toISOString(),
    fileUrl: '/mock/facture-orange.pdf',
    amount: "55,00",
    supplier: 'Orange',
    dueDate: addDays(now, 12).toISOString(),
  },
  {
    id: 'doc-3',
    name: 'Contrat de location - Apt Sahloul',
    category: 'Maison',
    createdAt: subDays(now, 90).toISOString(),
    fileUrl: '/mock/contrat-location.pdf',
    summary: "Contrat de location pour l'appartement situé à Sahloul, Sousse. Loyer mensuel de 850 TND.",
  },
  {
    id: 'doc-8',
    name: 'Tableau Amortissement Emprunt',
    category: 'Maison',
    createdAt: subDays(now, 120).toISOString(),
    fileUrl: '/mock/tableau-amortissement.pdf',
    summary: "Tableau d'amortissement pour l'emprunt immobilier de la maison.",
    supplier: 'Banque XYZ'
  },
  {
    id: 'doc-5',
    name: 'Reçu Bancaire - Retrait',
    category: 'Reçu Bancaire',
    createdAt: subDays(now, 2).toISOString(),
    fileUrl: '/mock/recu-carrefour.jpg',
    amount: "230,15",
    supplier: 'Banque ABC'
  },
   {
    id: 'doc-6',
    name: 'Assurance Habitation AMI',
    category: 'Maison',
    createdAt: subDays(now, 200).toISOString(),
    fileUrl: '/mock/assurance-ami.pdf',
    amount: "750,00",
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
    type: (doc.category === 'STEG' || doc.category === 'SONEDE') ? 'Paiement' : 'Renouvellement',
}));
