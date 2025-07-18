
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
      headers: {
        // PostImage API documentation suggests this header for JSON responses.
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PostImage API Error Response Text:', errorText);
      throw new Error(`Image upload failed with status: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status !== 'success' || !result.data?.url) {
      console.error('PostImage API returned an unsuccessful status or invalid data:', result);
      throw new Error('Image upload API returned an error or malformed data.');
    }

    // PostImage provides multiple URLs, 'url' is the direct link to the image.
    return result.data.url;

  } catch (error) {
    console.error('Error during the fetch operation to PostImage:', error);
    // Re-throw the original error if it's specific, otherwise throw the generic one.
    if (error instanceof Error && error.message.startsWith('Image upload failed')) {
        throw error;
    }
    throw new Error('Could not upload the image. Please try again.');
  }
}
