
import { NextResponse } from 'next/server';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase'; // We use the client-side initialized app
import { auth as adminAuth } from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin-auth-only';

// Initialize only the auth part of the admin SDK
try {
  initializeAdminApp();
} catch (error) {
  console.error("Failed to initialize Firebase Admin Auth SDK in API route.", error);
}

const storage = getStorage(app);

export async function POST(request: Request) {
  try {
    if (adminAuth().app.name === '') {
        throw new Error("Firebase Admin SDK for Auth not initialized. Check server logs for details.");
    }
    
    const authToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing auth token' }, { status: 401 });
    }

    const decodedToken = await adminAuth().verifyIdToken(authToken);
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

    const arrayBuffer = await file.arrayBuffer();
    
    // Upload using the client SDK from the server
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
    if (error.code === 403 || (error.message && error.message.includes("permission"))) {
      return NextResponse.json({ error: 'Permission denied. Make sure the Service Account has the "Storage Admin" role in IAM.' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
