
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { Document } from '@/lib/types';
import { parseISO, differenceInDays, format, getYear, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';

interface MonthlyExpense {
  month: string;
  [key: string]: number | string;
}

interface Alert {
  id: string;
  documentId: string;
  documentName: string;
  dueDate: string;
  type: 'Paiement' | 'Renouvellement';
}

interface DocumentContextType {
  documents: Document[];
  alerts: Alert[];
  monthlyExpenses: MonthlyExpense[];
  addDocument: (doc: Omit<Document, 'id' | 'createdAt'>) => Promise<void>;
  updateDocument: (id: string, data: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  markAsPaid: (id: string) => void;
  getDocumentById: (id: string) => Document | undefined;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const getLocalStorageKey = useCallback(() => {
    return user ? `lawra9-documents-${user.uid}` : null;
  }, [user]);

  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
        try {
          const storedDocuments = localStorage.getItem(key);
          if (storedDocuments) {
            const parsedDocs = JSON.parse(storedDocuments);
            setDocuments(parsedDocs.sort((a: Document, b: Document) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));
          } else {
            setDocuments([]); 
          }
        } catch (error) {
          console.error("Failed to load documents from local storage", error);
        }
    } else {
        setDocuments([]);
    }
  }, [user, getLocalStorageKey]);

  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
        try {
          const docsToStore = documents.map(({ ...doc }) => {
            return doc;
          });
          localStorage.setItem(key, JSON.stringify(docsToStore));
        } catch (error) {
           console.error("Failed to save documents to local storage", error);
           if (error instanceof DOMException && error.name === 'QuotaExceededError') {
             toast({
                variant: 'destructive',
                title: 'Erreur de stockage local',
                description: 'Le quota de stockage de votre navigateur est plein. Impossible de sauvegarder de nouveaux documents.'
             });
          }
        }
    }
  }, [documents, user, getLocalStorageKey, toast]);


  const addDocument = useCallback(async (doc: Omit<Document, 'id' | 'createdAt'>) => {
    const newDoc = { ...doc, id: `doc-${Date.now()}`, createdAt: new Date().toISOString() };
    setDocuments(prevDocs => [newDoc, ...prevDocs].sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));
  }, []);

  const updateDocument = useCallback(async (id: string, data: Partial<Document>) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => (doc.id === id ? { ...doc, ...data } : doc))
    );
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const docToDelete = documents.find(doc => doc.id === id);
    if (docToDelete && docToDelete.filePath) {
      try {
        const fileRef = ref(storage, docToDelete.filePath);
        await deleteObject(fileRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error("Error deleting file from Firebase Storage", error);
          toast({
            variant: 'destructive',
            title: 'Erreur de suppression',
            description: "Le fichier distant n'a pas pu être supprimé, mais la référence locale a été enlevée."
          });
        }
      }
    }
    setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== id));
    toast({ title: 'Document supprimé' });
  }, [documents, toast]);
  
  const markAsPaid = useCallback((id: string) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => (doc.id === id ? { ...doc, dueDate: undefined } : doc))
    );
  }, []);
  
  const getDocumentById = useCallback((id: string) => {
    return documents.find(doc => doc.id === id);
  }, [documents]);

  const alerts = useMemo(() => {
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
        type: (doc.category === 'STEG' || doc.category === 'SONEDE') ? 'Paiement' : 'Renouvellement',
      }))
      .sort((a,b) => differenceInDays(parseISO(a.dueDate), new Date()) - differenceInDays(parseISO(b.dueDate), new Date()));
  }, [documents]);

  const monthlyExpenses = useMemo(() => {
    const expensesByMonth: { [key: string]: { [key: string]: number } } = {};
    const currentYear = getYear(new Date());

    documents.forEach(doc => {
      if (!doc.amount || doc.category === 'Maison') return;

      let expenseDate: Date | null = null;
      const datePriority = [doc.issueDate, doc.billingEndDate, doc.dueDate, doc.createdAt];
      for (const dateStr of datePriority) {
          if(dateStr) {
              const date = parseISO(dateStr);
              if(isValid(date)) {
                  expenseDate = date;
                  break;
              }
          }
      }

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
    const result: MonthlyExpense[] = monthOrder.slice(0, new Date().getMonth() + 1).map(monthName => {
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
