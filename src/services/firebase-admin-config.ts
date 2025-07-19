
import * as admin from 'firebase-admin';

export function initAdminApp() {
    if (admin.apps.length > 0) {
        return;
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new Error("The FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. This is required for server-side authentication.");
    }
    
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

    } catch (error: any) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error);
        throw new Error("Could not initialize Firebase Admin SDK. Service account JSON is malformed.");
    }
}
