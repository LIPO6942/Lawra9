'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Receipt } from '@/lib/types';
import { openDB, addReceipt as dbAddReceipt, updateReceipt as dbUpdateReceipt, deleteReceipt as dbDeleteReceipt, getAllReceipts as dbGetAllReceipts } from '@/lib/idb';
import { useAuth } from './auth-context';

interface ReceiptContextType {
  receipts: Receipt[];
  addReceipt: (receipt: Omit<Receipt, 'id'>) => Promise<void>;
  updateReceipt: (id: string, data: Partial<Receipt>) => Promise<void>;
  deleteReceipt: (id: string) => Promise<void>;
  getReceiptById: (id: string) => Receipt | undefined;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export const ReceiptProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const { user } = useAuth();

  const loadReceipts = useCallback(async () => {
    if (!user) { setReceipts([]); return; }
    const db = await openDB(user.uid);
    const items = await dbGetAllReceipts(db);
    // Newest first by purchaseAt or created time encoded in id
    items.sort((a: Receipt, b: Receipt) => (new Date(b.purchaseAt || 0).getTime()) - (new Date(a.purchaseAt || 0).getTime()));
    setReceipts(items);
  }, [user]);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const addReceipt = async (data: Omit<Receipt, 'id'>) => {
    if (!user) return;
    const db = await openDB(user.uid);
    const receipt: Receipt = { id: `rcpt-${Date.now()}`, ...data };
    await dbAddReceipt(db, receipt);
    await loadReceipts();
  };

  const updateReceipt = async (id: string, data: Partial<Receipt>) => {
    if (!user) return;
    const db = await openDB(user.uid);
    const existing = receipts.find((r: Receipt) => r.id === id);
    if (!existing) return;
    await dbUpdateReceipt(db, { ...existing, ...data });
    await loadReceipts();
  };

  const deleteReceipt = async (id: string) => {
    if (!user) return;
    const db = await openDB(user.uid);
    await dbDeleteReceipt(db, id);
    await loadReceipts();
  };

  const getReceiptById = useCallback((id: string) => receipts.find(r => r.id === id), [receipts]);

  const value = useMemo(() => ({ receipts, addReceipt, updateReceipt, deleteReceipt, getReceiptById }), [receipts]);

  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
};

export const useReceipts = () => {
  const ctx = useContext(ReceiptContext);
  if (!ctx) throw new Error('useReceipts must be used within a ReceiptProvider');
  return ctx;
};
