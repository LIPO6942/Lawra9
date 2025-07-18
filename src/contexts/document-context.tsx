
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { Document, Alert } from '@/lib/types';
import { parseISO, differenceInDays, format, getYear, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from './auth-context';
import { storage } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

interface MonthlyExpense {
  month: string;
  [key: string]: number | string;
}

interface DocumentContextType {
  documents: Document[];
  alerts: Alert[];
  monthlyExpenses: MonthlyExpense[];
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, data: Partial<Document>) => void;
  deleteDocument: (id: string) => Promise<void>;
  markAsPaid: (id: string) => void;
  getDocumentById: (id: string) => Document | undefined;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const { userId } = useAuth();
  const { toast } = useToast();
  
  const getLocalStorageKey = useCallback(() => {
    return userId ? `lawra9-documents-${userId}` : null;
  }, [userId]);

  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
        try {
          const storedDocuments = localStorage.getItem(key);
          if (storedDocuments) {
            setDocuments(JSON.parse(storedDocuments));
          } else {
            setDocuments([]); 
          }
        } catch (error) {
          console.error("Failed to load documents from local storage", error);
        }
    } else {
        setDocuments([]);
    }
  }, [userId, getLocalStorageKey]);

  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
        try {
          // This now only stores metadata and URLs, not file content
          localStorage.setItem(key, JSON.stringify(documents));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
             console.error("Local storage quota exceeded. Cannot save documents.");
             toast({
                variant: 'destructive',
                title: 'Erreur de stockage local',
                description: 'Le quota de stockage de votre navigateur est plein. Impossible de sauvegarder de nouveaux documents.'
             });
          } else {
             console.error("Failed to save documents to local storage", error);
          }
        }
    }
  }, [documents, userId, getLocalStorageKey, toast]);


  const addDocument = useCallback((doc: Document) => {
    setDocuments(prevDocs => [doc, ...prevDocs]);
  }, []);

  const updateDocument = useCallback((id: string, data: Partial<Document>) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => (doc.id === id ? { ...doc, ...data } : doc))
    );
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const docToDelete = documents.find(doc => doc.id === id);
    if (!docToDelete) return;

    // Delete from Firebase Storage if filePath exists
    if (docToDelete.filePath) {
      const fileRef = ref(storage, docToDelete.filePath);
      try {
        await deleteObject(fileRef);
      } catch (error: any) {
        // If file not found, we can ignore, otherwise show error but still remove from list
        if (error.code !== 'storage/object-not-found') {
          console.error("Error deleting file from storage:", error);
          toast({
            variant: 'destructive',
            title: 'Erreur de suppression',
            description: "Le fichier distant n'a pas pu être supprimé, mais la référence locale a été enlevée."
          });
        }
      }
    }

    // Delete from local state and localStorage
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
      if (!doc.amount) return;

      let expenseDate: Date | null = null;
      const datePriority = [doc.billingEndDate, doc.dueDate, doc.createdAt];
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
      const categories = ['STEG', 'SONEDE', 'Reçu Bancaire', 'Internet', 'Autre'];
      
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

    