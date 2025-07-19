
import { createClient } from '@supabase/supabase-js';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { serviceAccount } from '@/services/firebase-admin-config';

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization Header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!uid) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Create a new Supabase client for each request, authenticated with the user's token.
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          // Pass the user's auth token to Supabase
          global: {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          },
        }
    );
    
    const { fileName, fileType } = await request.json();
    if (!fileName || !fileType) {
        return new Response(JSON.stringify({ error: 'fileName and fileType are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    const filePath = `${uid}/${Date.now()}-${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('lawra9')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Supabase createSignedUploadUrl error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Construct the public URL correctly
    const { data: { publicUrl } } = supabaseAdmin.storage.from('lawra9').getPublicUrl(filePath);

    return new Response(JSON.stringify({ signedUrl: data.signedUrl, publicUrl: publicUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (e: any) {
    console.error('API Route Error:', e);
    if (e.code === 'auth/id-token-expired' || e.code === 'auth/argument-error') {
        return new Response(JSON.stringify({ error: `Firebase Auth Error: ${e.message}` }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: e.message || 'An unknown server error occurred.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
