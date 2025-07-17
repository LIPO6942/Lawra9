
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
initializeAdminApp();

export async function POST(request: Request) {
  try {
    const authToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await admin.auth().verifyIdToken(authToken);
    const userId = decodedToken.uid;
    
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file || !fileName) {
      return NextResponse.json({ error: 'Missing file data or name' }, { status: 400 });
    }
    
    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const destination = `documents/${userId}/${Date.now()}-${fileName}`;
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
    await fileRef.makePublic();
    const fileUrl = fileRef.publicUrl();

    return NextResponse.json({ fileUrl });
  } catch (error: any) {
    console.error('Upload API error:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired' }, { status: 401 });
    }
    if (error.code === 403) {
      return NextResponse.json({ error: 'Permission denied. Make sure the Storage Admin role is set.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
