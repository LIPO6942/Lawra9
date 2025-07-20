
import { openDB as open, IDBPDatabase } from 'idb';
import { Document } from './types';

const DB_NAME_PREFIX = 'Lawra9DB';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

export async function openDB(userId: string): Promise<IDBPDatabase> {
  const dbName = `${DB_NAME_PREFIX}-${userId}`;
  return open<Document>(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
  return docs;
}

export async function getDocument(db: IDBPDatabase, id: string): Promise<Document | undefined> {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const doc = await tx.store.get(id);
  await tx.done;
  return doc;
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
