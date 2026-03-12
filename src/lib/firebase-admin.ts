import * as admin from 'firebase-admin';

// Lazy initialization — n'initialise Firebase Admin que quand on en a besoin (pas au build)
function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Debug logs pour voir ce que le serveur reçoit (sera visible dans les Runtime Logs de Vercel)
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('CRITICAL ERROR: Firebase Admin Credentials missing!');
    console.error('ProjectId:', !!projectId);
    console.error('ClientEmail:', !!clientEmail);
    console.error('PrivateKey:', !!privateKey);
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (err: any) {
    console.error('FIREBASE_ADMIN_INIT_ERROR:', err.message);
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
