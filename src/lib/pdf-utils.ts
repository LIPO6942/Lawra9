'use client';

import * as pdfjsLib from 'pdfjs-dist';

// Define the worker URL for pdfjs-dist
// We use a CDN to avoid complex local worker setup in Next.js
const PDF_JS_VERSION = '5.4.530'; // Matching package.json
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;

/**
 * Converts the first page of a PDF file to a base64 data URI image.
 * This is used to allow Groq (which only supports images) to process PDF documents.
 */
export async function convertPdfToImage(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // We only process the first page for now as it usually contains the main invoice data
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Use 2.0 scale for better OCR quality

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not create canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport,
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
}
