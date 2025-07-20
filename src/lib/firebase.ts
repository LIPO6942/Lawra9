
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

let app: FirebaseApp;
let auth: Auth;
let storage: FirebaseStorage;


// This check is crucial to ensure Firebase is initialized correctly.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
   try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Erreur d\'initialisation de Firebase:', error);
    // Provide dummy objects to prevent app from crashing if firebase fails to init
    app = {} as FirebaseApp;
    auth = {} as Auth;
    storage = {} as FirebaseStorage;
  }
} else {
    console.error(
    'ERREUR CRITIQUE: Configuration Firebase manquante. Assurez-vous que les variables NEXT_PUBLIC_FIREBASE_* sont dans votre fichier .env.local'
  );
  app = {} as FirebaseApp;
  auth = {} as Auth;
  storage = {} as FirebaseStorage;
}


export { app, auth, storage };
