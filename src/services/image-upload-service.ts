
'use server';

import { createClient } from "@supabase/supabase-js";

/**
 * Uploads an image to Supabase Storage and returns the public URL.
 * This is a server-side function.
 * @param file The image file to upload.
 * @param userId The ID of the user uploading the file.
 * @param authToken The Firebase JWT of the authenticated user.
 * @returns A promise that resolves to the public URL of the uploaded image.
 */
export async function uploadImage(file: File, userId: string, authToken: string): Promise<string> {
  if (!userId || !authToken) {
      throw new Error('User is not properly authenticated. Cannot upload file.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is missing in environment variables.');
  }
  
  // Create a new Supabase client for each server-side operation
  // and authenticate with the user's Firebase JWT.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
     auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const fileExtension = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExtension}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lawra9') 
      .upload(filePath, file, {
          upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw new Error(`Supabase Error: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('lawra9') 
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Could not get public URL for the uploaded file.');
    }
    
    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('Error during the upload operation to Supabase:', error);
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error('An unknown error occurred during image upload.');
  }
}
