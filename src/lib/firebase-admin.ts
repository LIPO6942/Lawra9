
import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!serviceAccount) {
  console.warn(
    'Firebase Admin SDK Service Account is not configured. Server-side Firebase features will not work.'
  );
}

export const initializeAdminApp = () => {
  if (admin.apps.length === 0 && serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
};
