
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
try {
  initializeAdminApp();
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK in API route.", error);
}

export async function POST(request: Request) {
  try {
    if (admin.apps.length === 0) {
        throw new Error("Firebase Admin SDK not initialized. Check server logs for details.");
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
    
    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const destination = `documents/${userId}/${Date.now()}-${file.name}`;
    const fileRef = bucket.file(destination);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using the admin SDK
    await fileRef.save(buffer, {
        metadata: {
            contentType: file.type,
        },
    });

    // Make the file public and get its URL
    const [fileUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // A very long time in the future
    });

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
