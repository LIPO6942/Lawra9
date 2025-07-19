
// src/services/firebase-admin-config.ts

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("The FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. This is required for server-side authentication.");
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export const serviceAccount: ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
