'use server';

/**
 * @fileOverview This file defines a Genkit flow for detecting the type of a document and suggesting relevant categories.
 *
 * - detectDocumentType - A function that accepts document data and returns the detected document type and a summary if the document is long.
 * - DetectDocumentTypeInput - The input type for the detectDocumentType function.
 * - DetectDocumentTypeOutput - The return type for the detectDocumentType function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectDocumentTypeInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The document data as a data URI (must include MIME type and be Base64 encoded). Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DetectDocumentTypeInput = z.infer<typeof DetectDocumentTypeInputSchema>;

const DetectDocumentTypeOutputSchema = z.object({
  documentType: z.string().describe('The detected type of the document (e.g., insurance, lease, maintenance).'),
  suggestedCategories: z.array(z.string()).describe('Suggested categories for the document.'),
  summary: z.string().optional().describe('A brief summary of the document if it is long.'),
});
export type DetectDocumentTypeOutput = z.infer<typeof DetectDocumentTypeOutputSchema>;

export async function detectDocumentType(
  input: DetectDocumentTypeInput
): Promise<DetectDocumentTypeOutput> {
  return detectDocumentTypeFlow(input);
}

const detectDocumentTypePrompt = ai.definePrompt({
  name: 'detectDocumentTypePrompt',
  input: {schema: DetectDocumentTypeInputSchema},
  output: {schema: DetectDocumentTypeOutputSchema},
  prompt: `You are an expert document classifier.  You will be provided with a document, and you will identify the type of document it is, suggest relevant categories for the document, and provide a summary of the document if it is long.

Document: {{media url=documentDataUri}}

Type:`,
});

const detectDocumentTypeFlow = ai.defineFlow(
  {
    name: 'detectDocumentTypeFlow',
    inputSchema: DetectDocumentTypeInputSchema,
    outputSchema: DetectDocumentTypeOutputSchema,
  },
  async input => {
    const {output} = await detectDocumentTypePrompt(input);
    return output!;
  }
);
