'use server';

/**
 * @fileOverview Implements fuzzy search for documents using GenAI to interpret search terms.
 *
 * - fuzzySearchDocuments - A function that takes a fuzzy search term and returns relevant document IDs.
 * - FuzzySearchDocumentsInput - The input type for the fuzzySearchDocuments function.
 * - FuzzySearchDocumentsOutput - The return type for the fuzzySearchDocuments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FuzzySearchDocumentsInputSchema = z.object({
  searchTerm: z.string().describe('Le terme de recherche approximatif saisi par l\'utilisateur.'),
  documentIds: z.array(z.string()).describe('Une liste d\'ID de documents dans laquelle chercher.')
});
export type FuzzySearchDocumentsInput = z.infer<typeof FuzzySearchDocumentsInputSchema>;

const FuzzySearchDocumentsOutputSchema = z.array(z.string()).describe('Une liste d\'ID de documents pertinents qui correspondent au terme de recherche.');
export type FuzzySearchDocumentsOutput = z.infer<typeof FuzzySearchDocumentsOutputSchema>;

export async function fuzzySearchDocuments(input: FuzzySearchDocumentsInput): Promise<FuzzySearchDocumentsOutput> {
  return fuzzySearchDocumentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fuzzySearchDocumentsPrompt',
  input: {schema: FuzzySearchDocumentsInputSchema},
  output: {schema: FuzzySearchDocumentsOutputSchema},
  prompt: `Vous êtes un expert en assistance à la recherche. Étant donné un terme de recherche d'un utilisateur,
votre travail consiste à identifier quels documents sont pertinents pour ce terme de recherche.
Même si le terme de recherche contient des fautes d'orthographe, des synonymes ou des abréviations,
vous devez tout de même essayer d'identifier les bons documents. Les ID des documents
qui sont à votre disposition sont listés dans le champ d'entrée documentIds. Si aucun document
n'est pertinent, retournez un tableau vide.

Terme de recherche : {{{searchTerm}}}
Documents disponibles : {{{documentIds}}}

IDs de documents pertinents :`,
});

const fuzzySearchDocumentsFlow = ai.defineFlow(
  {
    name: 'fuzzySearchDocumentsFlow',
    inputSchema: FuzzySearchDocumentsInputSchema,
    outputSchema: FuzzySearchDocumentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
