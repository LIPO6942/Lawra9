// src/app/api/upload-url/route.ts
import { createClient } from '@supabase/supabase-js';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { serviceAccount } from '@/services/firebase-admin-config';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    },
  });
}

// Initialize Supabase Admin Client
// Note: We use the service_role key here for admin-level access
// This should be kept secure and only used on the server.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!uid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { fileName, fileType } = await request.json();
    if (!fileName || !fileType) {
        return new Response(JSON.stringify({ error: 'fileName and fileType are required' }), { status: 400 });
    }
    
    const filePath = `${uid}/${Date.now()}-${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('lawra9')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Supabase signed URL error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ signedUrl: data.signedUrl, publicUrl: supabaseAdmin.storage.from('lawra9').getPublicUrl(filePath).data.publicUrl }), { status: 200 });
    
  } catch (e: any) {
    console.error('API Error:', e);
    return new Response(JSON.stringify({ error: e.message || 'An unknown error occurred.' }), { status: 500 });
  }
}
