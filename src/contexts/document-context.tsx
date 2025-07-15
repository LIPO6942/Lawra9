
'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Document, Alert } from '@/lib/types';
import { mockDocuments } from '@/lib/data';
import { parseISO, differenceInDays } from 'date-fns';

interface DocumentContextType {
  documents: Document[];
  alerts: Alert[];
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
        type: doc.category === 'Facture' ? 'Paiement' : 'Renouvellement',
      }))
      .sort((a,b) => differenceInDays(parseISO(a.dueDate), new Date()) - differenceInDays(parseISO(b.dueDate), new Date()));
  }, [documents]);

  const value = {
    documents,
    alerts,
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
