
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Document, Alert } from '@/lib/types';
import { mockDocuments } from '@/lib/data';
import { parseISO, differenceInDays, format, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';


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
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);

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

  const alerts = useMemo(() => {
    return documents
      .filter(doc => !!doc.dueDate)
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

    documents
        .filter(doc => doc.amount && getYear(parseISO(doc.createdAt)) === currentYear)
        .forEach(doc => {
            const month = format(parseISO(doc.createdAt), 'MMM', { locale: fr });
            const category = doc.category;

            if (!expensesByMonth[month]) {
                expensesByMonth[month] = {};
            }
            if (!expensesByMonth[month][category]) {
                expensesByMonth[month][category] = 0;
            }
            expensesByMonth[month][category] += doc.amount!;
        });

    const monthOrder = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const result: MonthlyExpense[] = monthOrder.slice(0, new Date().getMonth() + 1).map(monthName => {
        const monthData: MonthlyExpense = { month: monthName };
        const categories = ['STEG', 'SONEDE', 'Reçu Bancaire', 'Autre'];
        
        categories.forEach(cat => {
            monthData[cat] = expensesByMonth[monthName.replace('.','')]?.[cat] || 0;
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
