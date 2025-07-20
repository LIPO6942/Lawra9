
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function initializeFirebaseClient(): boolean {
  if (app) {
    return true;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(
      'ERREUR CRITIQUE: Configuration Firebase manquante. Assurez-vous que les variables NEXT_PUBLIC_FIREBASE_* sont dans votre fichier .env.local.'
    );
    return false; // Indicate failure instead of throwing
  }
  
  if (getApps().length === 0) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        app = null;
        auth = null;
        return false;
    }
  } else {
    app = getApp();
    auth = getAuth(app);
  }
  return true;
}

function getFirebaseAuth(): Auth | null {
  if (!auth) {
    if (!initializeFirebaseClient()) {
        return null;
    }
  }
  return auth;
}

export { getFirebaseAuth, initializeFirebaseClient };
