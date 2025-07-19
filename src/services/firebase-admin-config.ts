
import * as admin from 'firebase-admin';

export function initAdminApp() {
    if (admin.apps.length > 0) {
        return;
    }

    // On s'attend maintenant à des variables individuelles, ce qui est plus robuste pour Vercel.
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // La clé privée doit être formatée correctement. Le .replace() est crucial.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Les variables d'environnement Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) ne sont pas toutes définies.");
    }
    
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        console.log("Firebase Admin SDK initialisé avec succès.");

    } catch (error: any) {
        console.error("Erreur d'initialisation du SDK Firebase Admin:", error);
        throw new Error("Impossible d'initialiser le SDK Firebase Admin. Vérifiez les variables d'environnement sur Vercel.");
    }
}
