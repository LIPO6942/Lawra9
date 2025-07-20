
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// IMPORTANT: Remplacez ces valeurs par vos vraies clés Firebase.
// Cette méthode est utilisée car la lecture de .env.local est instable dans cet environnement.
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY_ICI",
  authDomain: "VOTRE_AUTH_DOMAIN_ICI",
  projectId: "VOTRE_PROJECT_ID_ICI",
  storageBucket: "VOTRE_STORAGE_BUCKET_ICI",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID_ICI",
  appId: "VOTRE_APP_ID_ICI",
};

let app: FirebaseApp;
let auth: Auth;

// Assurez-vous que les clés ne sont pas les valeurs d'exemple avant d'initialiser.
if (firebaseConfig.apiKey === "VOTRE_API_KEY_ICI") {
    console.error("ERREUR: Veuillez remplacer les valeurs d'exemple dans src/lib/firebase.ts par vos vraies clés Firebase.");
}

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

auth = getAuth(app);

export { app, auth };
