
'use server';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { auth as adminAuth } from 'firebase-admin';
import { initAdminApp } from '@/services/firebase-admin-config';

initAdminApp();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL or service role key is not defined in environment variables.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  const authToken = request.headers.get('authorization')?.split('Bearer ')[1];
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth().verifyIdToken(authToken);
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const userId = decodedToken.uid;
  const { fileName, fileType } = await request.json();

  if (!fileName || !fileType) {
    return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
  }

  const filePath = `${userId}/${Date.now()}-${fileName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Supabase createSignedUploadUrl error:', error);
      throw error;
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('documents').getPublicUrl(filePath);
    
    return NextResponse.json({ signedUrl: data.signedUrl, publicUrl: publicUrlData.publicUrl });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred' }, { status: 500 });
  }
}
