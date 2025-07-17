
import * as admin from 'firebase-admin';

let serviceAccount: admin.ServiceAccount;

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (serviceAccountString) {
  try {
    // The service account key is expected to be a base64 encoded string in the environment variable
    const decodedString = Buffer.from(serviceAccountString, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decodedString);
  } catch (e) {
    // Fallback for raw JSON string
    try {
        serviceAccount = JSON.parse(serviceAccountString);
    } catch(jsonError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string or base64 encoded.', jsonError);
    }
  }
} else {
    console.error(
      'CRITICAL: Firebase Admin SDK Service Account key is not found in environment variables (FIREBASE_SERVICE_ACCOUNT_KEY). Server-side Firebase features will not work.'
    );
}

export const initializeAdminApp = () => {
  if (admin.apps.length === 0 && serviceAccount) {
    try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
        console.error("Error initializing Firebase Admin SDK:", error.message);
        throw error;
    }
  }
};
