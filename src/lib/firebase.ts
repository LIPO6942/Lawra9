
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Cette configuration lit les variables d'environnement `NEXT_PUBLIC_`
// qui sont exposées au client par Next.js.
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

// Vérifie si les clés sont chargées pour éviter les erreurs.
if (!firebaseConfig.apiKey) {
    console.error("ERREUR: La configuration Firebase est manquante. Assurez-vous que les variables NEXT_PUBLIC_FIREBASE_* sont définies dans votre environnement ou votre fichier .env.local et que le serveur a été redémarré.");
}

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

auth = getAuth(app);

export { app, auth };
