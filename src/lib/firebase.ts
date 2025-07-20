
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialization for Firebase App
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  // This check is crucial to ensure Firebase is initialized correctly.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
     throw new Error(
      'ERREUR CRITIQUE: Configuration Firebase manquante. Assurez-vous que les variables NEXT_PUBLIC_FIREBASE_* sont dans votre fichier .env.local et que le serveur a été redémarré.'
    );
  }
  
  return initializeApp(firebaseConfig);
}

// We export functions that ensure the app is initialized before getting the service.
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

function getFirebaseAuth(): Auth {
    if (!authInstance) {
        authInstance = getAuth(getFirebaseApp());
    }
    return authInstance;
}

function getFirebaseStorage(): FirebaseStorage {
    if (!storageInstance) {
        storageInstance = getStorage(getFirebaseApp());
    }
    return storageInstance;
}


// Export getters instead of direct instances
export const app = getFirebaseApp();
export const auth = getFirebaseAuth();
export const storage = getFirebaseStorage();
