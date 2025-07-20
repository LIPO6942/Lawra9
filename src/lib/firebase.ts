
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

function initializeFirebaseClient() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'ERREUR CRITIQUE: Configuration Firebase manquante. Assurez-vous que les variables NEXT_PUBLIC_FIREBASE_* sont dans votre fichier .env.local.'
    );
  }
  
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    app = getApp();
    auth = getAuth(app);
  }
}

function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebaseClient();
  }
  return auth!;
}

// Export a function to get the auth instance, which will initialize if needed.
export { getFirebaseAuth, initializeFirebaseClient };
