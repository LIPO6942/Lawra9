
'use server';

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

/**
 * Uploads an image to Supabase Storage and returns the public URL.
 * @param file The image file to upload.
 * @param userId The ID of the user uploading the file, to store it in a user-specific folder.
 * @returns A promise that resolves to the public URL of the uploaded image.
 */
export async function uploadImage(file: File, userId: string): Promise<string> {
  if (!userId) {
      throw new Error('User is not authenticated. Cannot upload file.');
  }

  const fileExtension = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExtension}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents') // This is the bucket name
      .upload(filePath, file);

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Could not get public URL for the uploaded file.');
    }
    
    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('Error during the upload operation to Supabase:', error);
    if (error instanceof Error) {
        throw new Error(`Could not upload the image: ${error.message}`);
    }
    throw new Error('An unknown error occurred during image upload.');
  }
}
