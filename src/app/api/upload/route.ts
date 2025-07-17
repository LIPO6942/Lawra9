
import { NextResponse } from 'next/server';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase'; // We use the client-side initialized app
import * as admin from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';

const storage = getStorage(app);

// Initialize Firebase Admin SDK
try {
  initializeAdminApp();
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK in API route.", error);
}

export async function POST(request: Request) {
  try {
    // Check if Admin SDK was initialized
    if (admin.apps.length === 0) {
        console.error("CRITICAL: Firebase Admin SDK not initialized in API route. Check server logs for details.");
        throw new Error("Server configuration error: Firebase Admin SDK not initialized.");
    }

    const authToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing auth token' }, { status: 401 });
    }

    const decodedToken = await admin.auth().verifyIdToken(authToken);
    const userId = decodedToken.uid;
    
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file data' }, { status: 400 });
    }
    
    const destination = `documents/${userId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, destination);

    // Convert file to buffer to upload from server
    const arrayBuffer = await file.arrayBuffer();
    
    // Upload using the client SDK's uploadBytes function from the server context
    await uploadBytes(storageRef, arrayBuffer, {
        contentType: file.type,
    });

    // Get the public URL
    const fileUrl = await getDownloadURL(storageRef);

    return NextResponse.json({ fileUrl });

  } catch (error: any) {
    console.error('Upload API error:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired' }, { status: 401 });
    }
    if (error.message && error.message.includes("permission")) {
      return NextResponse.json({ error: 'Permission denied. Make sure your Storage Rules in Firebase allow writes for authenticated users.' }, { status: 403 });
    }
    // Return a generic error message to the client
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
