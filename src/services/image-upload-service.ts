
'use server';

/**
 * Uploads an image to the PostImage service and returns the public URL.
 * This is a free alternative to Firebase Storage that doesn't require a credit card.
 * @param file The image file to upload.
 * @returns A promise that resolves to the public URL of the uploaded image.
 */
export async function uploadImage(file: File): Promise<string> {
  const apiUrl = 'https://api.postimages.org/1/upload';
  const apiKey = '0e0b3c6e46594d2e8508e82a6f2b1860'; // This is a public key for guest uploads

  const formData = new FormData();
  formData.append('image', file);
  formData.append('key', apiKey);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Image upload failed: ${errorData.error.message}`);
    }

    const result = await response.json();
    
    if (result.status !== 'success') {
      throw new Error('Image upload API returned an error.');
    }

    // PostImage provides multiple URLs, 'url' is the direct link to the image.
    return result.data.url;

  } catch (error) {
    console.error('Error uploading to PostImage:', error);
    throw new Error('Could not upload the image. Please try again.');
  }
}
