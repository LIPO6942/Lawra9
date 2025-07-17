
import { NextResponse } from 'next/server';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth as adminAuth } from 'firebase-admin';
import { initializeAdminApp } from '@/lib/firebase-admin';

// Initialize Firebase Admin SDK
initializeAdminApp();

export async function POST(request: Request) {
  try {
    const authToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await adminAuth().verifyIdToken(authToken);
    const userId = decodedToken.uid;
    
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    const { fileData, fileName } = await request.json();

    if (!fileData || !fileName) {
      return NextResponse.json({ error: 'Missing file data or name' }, { status: 400 });
    }

    const storageRef = ref(storage, `documents/${userId}/${Date.now()}-${fileName}`);
    
    // The 'data_url' string tells Firebase to handle the base64-encoded string
    const snapshot = await uploadString(storageRef, fileData, 'data_url');
    const fileUrl = await getDownloadURL(snapshot.ref);

    return NextResponse.json({ fileUrl });
  } catch (error: any) {
    console.error('Upload API error:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
