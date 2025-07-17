
import * as admin from 'firebase-admin';

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let serviceAccount: admin.ServiceAccount | undefined;

if (serviceAccountString) {
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.', e);
  }
} else {
    console.warn(
      'Firebase Admin SDK Service Account key is not found in environment variables. Server-side Firebase features will not work.'
    );
}

export const initializeAdminApp = () => {
  if (admin.apps.length === 0 && serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } else if (admin.apps.length > 0) {
    // Already initialized
  } else {
    console.error("Could not initialize Firebase Admin SDK: Service Account is missing or invalid.");
  }
};
