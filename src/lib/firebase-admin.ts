import * as admin from 'firebase-admin';

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // On récupère les variables avec les noms exacts de ton Vercel
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'lawra9-ee888';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('CONFIG_ERROR: FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY est manquant dans les variables Vercel.');
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        // On utilise les noms de propriétés attendus par le format Service Account de Google
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      } as any),
    });
  } catch (err: any) {
    console.error('Erreur fatale lors de l\'initialisation Firebase Admin:', err.message);
    throw err;
  }
}

export function getAdminDb() {
  getAdminApp();
  return admin.firestore();
}

export function getAdminAuth() {
  getAdminApp();
  return admin.auth();
}

export { admin };
