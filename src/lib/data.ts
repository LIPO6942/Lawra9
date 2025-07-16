
import { Document, Alert } from './types';
import { subDays, addDays, startOfMonth, endOfMonth } from 'date-fns';

const now = new Date();

export const mockDocuments: Document[] = [];

export const mockAlerts: Alert[] = mockDocuments
.filter(doc => !!doc.dueDate)
.map(doc => ({
    id: `alert-${doc.id}`,
    documentId: doc.id,
    documentName: doc.name,
    dueDate: doc.dueDate!,
    type: (doc.category === 'STEG' || doc.category === 'SONEDE') ? 'Paiement' : 'Renouvellement',
}));
