

import * as admin from 'firebase-admin';

export function initAdminApp() {
    if (admin.apps.length > 0) {
        return;
    }

    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!serviceAccountBase64) {
        throw new Error("The FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set. This is required for server-side authentication and must be a Base64 encoded service account JSON.");
    }
    
    try {
        const decodedServiceAccount = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(decodedServiceAccount);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

    } catch (error: any) {
        console.error("Failed to decode or parse FIREBASE_SERVICE_ACCOUNT_BASE64:", error);
        throw new Error("Could not initialize Firebase Admin SDK. The service account might be malformed or not correctly Base64 encoded.");
    }
}

