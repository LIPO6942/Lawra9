
import { openDB as open, IDBPDatabase } from 'idb';
import { Document, Receipt } from './types';

const DB_NAME_PREFIX = 'Lawra9DB';
const STORE_NAME = 'documents';
const RECEIPTS_STORE = 'receipts';
const DB_VERSION = 2;

export async function openDB(userId: string): Promise<IDBPDatabase> {
  const dbName = `${DB_NAME_PREFIX}-${userId}`;
  return open(dbName, DB_VERSION, {
    upgrade(db: IDBPDatabase) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(RECEIPTS_STORE)) {
        db.createObjectStore(RECEIPTS_STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function addDocument(db: IDBPDatabase, doc: Document): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.add(doc);
  await tx.done;
}

export async function getAllDocuments(db: IDBPDatabase): Promise<Document[]> {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const docs = await tx.store.getAll();
  await tx.done;
  return docs as Document[];
}

export async function getDocument(db: IDBPDatabase, id: string): Promise<Document | undefined> {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const doc = await tx.store.get(id);
  await tx.done;
  return doc as Document | undefined;
}

export async function updateDocument(db: IDBPDatabase, doc: Document): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.put(doc);
  await tx.done;
}

export async function deleteDocument(db: IDBPDatabase, id: string): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}

// ======================
// Receipts CRUD helpers
// ======================

export async function addReceipt(db: IDBPDatabase, receipt: Receipt): Promise<void> {
  const tx = db.transaction(RECEIPTS_STORE, 'readwrite');
  await tx.store.add(receipt);
  await tx.done;
}

export async function getAllReceipts(db: IDBPDatabase): Promise<Receipt[]> {
  const tx = db.transaction(RECEIPTS_STORE, 'readonly');
  const items = await tx.store.getAll();
  await tx.done;
  return items as Receipt[];
}

export async function getReceipt(db: IDBPDatabase, id: string): Promise<Receipt | undefined> {
  const tx = db.transaction(RECEIPTS_STORE, 'readonly');
  const item = await tx.store.get(id);
  await tx.done;
  return item as Receipt | undefined;
}

export async function updateReceipt(db: IDBPDatabase, receipt: Receipt): Promise<void> {
  const tx = db.transaction(RECEIPTS_STORE, 'readwrite');
  await tx.store.put(receipt);
  await tx.done;
}

export async function deleteReceipt(db: IDBPDatabase, id: string): Promise<void> {
  const tx = db.transaction(RECEIPTS_STORE, 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}
