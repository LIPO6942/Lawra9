
'use server';

import { supabase } from "@/lib/supabase";

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
      .from('lawra9') // Bucket name updated to match user's bucket
      .upload(filePath, file);

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      // Throw the specific error from Supabase for better debugging
      throw new Error(`Supabase Error: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('lawra9') // Bucket name updated to match user's bucket
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Could not get public URL for the uploaded file.');
    }
    
    return publicUrlData.publicUrl;

  } catch (error) {
    // Log the error and re-throw it to be caught by the UI component.
    // This allows the UI to display a more specific error message.
    console.error('Error during the upload operation to Supabase:', error);
    if (error instanceof Error) {
        // Re-throw the original error message to be more informative
        throw new Error(error.message);
    }
    throw new Error('An unknown error occurred during image upload.');
  }
}
