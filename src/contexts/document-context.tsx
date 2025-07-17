
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { Document, Alert } from '@/lib/types';
import { parseISO, differenceInDays, format, getYear, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

const LOCAL_STORAGE_KEY = 'lawra9-documents';

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
  deleteDocument: (id: string) => void;
  markAsPaid: (id: string) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    try {
      const storedDocuments = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedDocuments) {
        setDocuments(JSON.parse(storedDocuments));
      }
    } catch (error) {
      console.error("Failed to load documents from local storage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(documents));
    } catch (error) {
      console.error("Failed to save documents to local storage", error);
    }
  }, [documents]);


  const addDocument = useCallback((doc: Document) => {
    setDocuments(prevDocs => [doc, ...prevDocs]);
  }, []);

  const updateDocument = useCallback((id: string, data: Partial<Document>) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => (doc.id === id ? { ...doc, ...data } : doc))
    );
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== id));
  }, []);
  
  const markAsPaid = useCallback((id: string) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => (doc.id === id ? { ...doc, dueDate: undefined } : doc))
    );
  }, []);

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

      // Determine the relevant date for the expense
      let expenseDate: Date | null = null;
      if (doc.billingEndDate && isValid(parseISO(doc.billingEndDate))) {
        expenseDate = parseISO(doc.billingEndDate);
      } else if (doc.dueDate && isValid(parseISO(doc.dueDate))) {
        expenseDate = parseISO(doc.dueDate);
      } else if (doc.createdAt && isValid(parseISO(doc.createdAt))) {
        expenseDate = parseISO(doc.createdAt);
      }

      if (expenseDate && getYear(expenseDate) === currentYear) {
        try {
          const month = format(expenseDate, 'MMM', { locale: fr }).replace('.', '');
          const category = doc.category;
          const amount = parseFloat(doc.amount.replace(',', '.'));

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
