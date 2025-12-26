import { NextResponse } from 'next/server';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';

// Temporary test endpoint to verify Groq/Gemini/OCR functionality.
// Replace `sampleUrl` with a publicly accessible image of a receipt.
export async function GET() {
    const sampleUrl = 'https://example.com/sample-receipt.jpg';
    try {
        const result = await extractReceiptData({
            receiptDataUri: sampleUrl,
        });
        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error('Test receipt extraction failed:', error);
        return NextResponse.json({ success: false, error: (error as any).message }, { status: 500 });
    }
}
