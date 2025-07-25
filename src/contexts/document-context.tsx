
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { Alert, Document, DocumentWithFile } from '@/lib/types';
import { parseISO, differenceInDays, format, getYear, isValid, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  openDB,
  addDocument as dbAddDocument,
  updateDocument as dbUpdateDocument,
  deleteDocument as dbDeleteDocument,
  getAllDocuments as dbGetAllDocuments
} from '@/lib/idb';

interface MonthlyExpense {
  month: string;
  [key: string]: number | string;
}

interface DocumentContextType {
  documents: Document[];
  alerts: Alert[];
  monthlyExpenses: MonthlyExpense[];
  addDocument: (doc: DocumentWithFile) => Promise<void>;
  updateDocument: (id: string, data: Partial<Document>, file?: File | null) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  markAsPaid: (id: string) => void;
  getDocumentById: (id: string) => Document | undefined;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

const getDocumentDate = (doc: Document): Date | null => {
    const datePriority = [doc.issueDate, doc.billingEndDate, doc.dueDate, doc.createdAt];
    for (const dateStr of datePriority) {
        if (dateStr) {
            const date = parseISO(dateStr);
            if (isValid(date)) {
                return date;
            }
        }
    }
    return null;
}

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const loadDocuments = useCallback(async () => {
    if (user) {
      try {
        const db = await openDB(user.uid);
        const docs = await dbGetAllDocuments(db);
        const docsWithUrls = docs.map(doc => {
          if (doc.file instanceof Blob && (!doc.fileUrl || !doc.fileUrl.startsWith('blob:'))) {
            return { ...doc, fileUrl: URL.createObjectURL(doc.file) };
          }
          return doc;
        });
        setDocuments(docsWithUrls.sort((a, b) => {
            const dateA = getDocumentDate(a);
            const dateB = getDocumentDate(b);
            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            return 0;
        }));
      } catch (error) {
        console.error("Failed to load documents from IndexedDB", error);
        toast({ variant: 'destructive', title: 'Erreur de chargement', description: 'Impossible de charger vos documents.' });
      }
    } else {
      setDocuments([]);
    }
  }, [user, toast]);

  useEffect(() => {
    loadDocuments();

    // Cleanup object URLs on unmount
    return () => {
      documents.forEach(doc => {
        if (doc.fileUrl && doc.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(doc.fileUrl);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  const addDocument = async (doc: DocumentWithFile) => {
    if (!user) return;
    const db = await openDB(user.uid);
    const newDoc = { ...doc, id: `doc-${Date.now()}`, createdAt: new Date().toISOString() };
    await dbAddDocument(db, newDoc);
    await loadDocuments(); // Refresh state from DB
  };

  const updateDocument = async (id: string, data: Partial<Document>, file?: File | null) => {
    if (!user) return;
    const db = await openDB(user.uid);
    const docToUpdate = documents.find(d => d.id === id);
    if (!docToUpdate) return;
    
    const updatedData = { ...docToUpdate, ...data };
    
    // If a new file is provided (or removed), update it. Otherwise, keep the old one.
    if (file) {
      updatedData.file = file;
       if (updatedData.fileUrl && updatedData.fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(updatedData.fileUrl);
      }
      delete updatedData.fileUrl; // It will be recreated on next load
    } else if (file === null) { // Explicitly removing file
      delete updatedData.file;
       if (updatedData.fileUrl && updatedData.fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(updatedData.fileUrl);
      }
      delete updatedData.fileUrl;
    }

    await dbUpdateDocument(db, updatedData);
    await loadDocuments(); // Refresh state from DB
  };

  const deleteDocument = async (id: string) => {
    if (!user) return;
    const db = await openDB(user.uid);
    await dbDeleteDocument(db, id);
    await loadDocuments(); // Refresh state from DB
    toast({ title: 'Document supprimé' });
  };
  
  const markAsPaid = useCallback(async (id: string) => {
    if (!user) return;
    const db = await openDB(user.uid);
    const docToUpdate = documents.find(d => d.id === id);
    if (docToUpdate) {
        // Always set the issueDate to now to correctly anchor the expense to the payment date.
        // This ensures it is included in the current month's expenses.
        docToUpdate.issueDate = new Date().toISOString();
        
        // Remove due date to clear the alert.
        docToUpdate.dueDate = undefined;

        await dbUpdateDocument(db, docToUpdate);
        await loadDocuments();
        toast({ title: 'Document marqué comme payé' });
    }
  }, [user, documents, loadDocuments, toast]);
  
  const getDocumentById = useCallback((id: string): Document | undefined => {
    return documents.find(doc => doc.id === id);
  }, [documents]);

  const alerts = useMemo((): Alert[] => {
    return documents
      .filter(doc => {
        if (!doc.dueDate || doc.category === 'Maison') return false;
        try {
          return isValid(parseISO(doc.dueDate));
        } catch(e) {
          return false;
        }
      })
      .map(doc => ({
        id: `alert-${doc.id}`,
        documentId: doc.id,
        documentName: doc.name,
        dueDate: doc.dueDate!,
        type: ((doc.category === 'STEG' || doc.category === 'SONEDE') ? 'Paiement' : 'Renouvellement') as Alert['type'],
      }))
      .sort((a,b) => differenceInDays(parseISO(a.dueDate), new Date()) - differenceInDays(parseISO(b.dueDate), new Date()));
  }, [documents]);

  const monthlyExpenses = useMemo(() => {
    const expensesByMonth: { [key: string]: { [key: string]: number } } = {};
    const currentYear = getYear(new Date());

    documents.forEach(doc => {
      if (!doc.amount || doc.category === 'Maison') return;

      const expenseDate = getDocumentDate(doc);

      if (expenseDate && getYear(expenseDate) === currentYear) {
        try {
          const month = format(expenseDate, 'MMM', { locale: fr }).replace('.', '');
          const category = doc.category;
          const amount = parseFloat(String(doc.amount).replace(',', '.'));

          if (isNaN(amount)) return;

          if (!expensesByMonth[month]) {
            expensesByMonth[month] = {};
          }
          if (!expensesByMonth[month][category]) {
            expensesByMonth[month][category] = 0;
          }
          expensesByMonth[month][category] += amount;
        } catch (e) {
          console.error(`Could not process expense for doc ${doc.id}:`, e);
        }
      }
    });

    const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
    const result: MonthlyExpense[] = monthOrder.slice(0, getMonth(new Date()) + 1).map(monthName => {
      const monthData: MonthlyExpense = { month: `${monthName}.` };
      const categories = ['STEG', 'SONEDE', 'Reçu Bancaire', 'Internet', 'Maison', 'Assurance', 'Contrat', 'Autre'];
      
      categories.forEach(cat => {
        monthData[cat] = expensesByMonth[monthName]?.[cat] || 0;
      });
      
      return monthData;
    });
    
    return result;
  }, [documents]);


  const value = {
    documents,
    alerts,
    monthlyExpenses,
    addDocument,
    updateDocument,
    deleteDocument,
    markAsPaid,
    getDocumentById,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};
