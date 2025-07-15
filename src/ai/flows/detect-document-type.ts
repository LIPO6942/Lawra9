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
  documentType: z.enum(['STEG', 'SONEDE', 'Reçu Bancaire', 'Maison', 'Autre']).describe('Le type de document détecté (STEG, SONEDE, Reçu Bancaire, Maison, Autre).'),
  suggestedCategories: z.array(z.string()).describe('Catégories suggérées pour le document.'),
  summary: z.string().optional().describe('Un bref résumé du document s\'il est long.'),
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
  prompt: `Vous êtes un expert en classification de documents tunisiens. Vous recevrez un document et vous devrez identifier son type parmi les choix suivants : STEG (facture d'électricité), SONEDE (facture d'eau), Reçu Bancaire (reçu de retrait, de dépôt, etc.), Maison (contrat de location, titre de propriété), ou Autre.

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
