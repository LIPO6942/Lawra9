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
  searchTerm: z.string().describe('The fuzzy search term entered by the user.'),
  documentIds: z.array(z.string()).describe('A list of document IDs to search through.')
});
export type FuzzySearchDocumentsInput = z.infer<typeof FuzzySearchDocumentsInputSchema>;

const FuzzySearchDocumentsOutputSchema = z.array(z.string()).describe('A list of relevant document IDs that match the search term.');
export type FuzzySearchDocumentsOutput = z.infer<typeof FuzzySearchDocumentsOutputSchema>;

export async function fuzzySearchDocuments(input: FuzzySearchDocumentsInput): Promise<FuzzySearchDocumentsOutput> {
  return fuzzySearchDocumentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fuzzySearchDocumentsPrompt',
  input: {schema: FuzzySearchDocumentsInputSchema},
  output: {schema: FuzzySearchDocumentsOutputSchema},
  prompt: `You are an expert search assistant. Given a user's search term, 
your job is to identify which documents are relevant to the search term.
Even if the search term contains misspellings, synonyms, or abbreviations,
you should still try to identify the correct documents. The document IDs that
are available to you are listed in the documentIds input field. If no documents
are relevant, return an empty array.

Search Term: {{{searchTerm}}}
Available Documents: {{{documentIds}}}

Relevant Document IDs:`, // Ensure output is a JSON array of strings.
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
