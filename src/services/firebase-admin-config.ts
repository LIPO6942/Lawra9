// src/services/firebase-admin-config.ts

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("The FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. This is required for server-side authentication.");
}

export const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
