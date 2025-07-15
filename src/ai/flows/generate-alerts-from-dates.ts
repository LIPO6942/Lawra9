'use server';
/**
 * @fileOverview Extracts dates from a document and generates alerts.
 *
 * - generateAlertsFromDates - A function that extracts dates and generates alerts.
 * - GenerateAlertsFromDatesInput - The input type for the generateAlertsFromDates function.
 * - GenerateAlertsFromDatesOutput - The return type for the generateAlertsFromDates function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAlertsFromDatesInputSchema = z.object({
  documentText: z.string().describe('The text content of the document.'),
});
export type GenerateAlertsFromDatesInput = z.infer<typeof GenerateAlertsFromDatesInputSchema>;

const GenerateAlertsFromDatesOutputSchema = z.array(z.object({
  date: z.string().describe('The extracted date in ISO format (YYYY-MM-DD).'),
  type: z.string().describe('The type of date (e.g., expiration, renewal, due date).'),
  description: z.string().describe('A description of the event associated with the date.'),
}));
export type GenerateAlertsFromDatesOutput = z.infer<typeof GenerateAlertsFromDatesOutputSchema>;

export async function generateAlertsFromDates(input: GenerateAlertsFromDatesInput): Promise<GenerateAlertsFromDatesOutput> {
  return generateAlertsFromDatesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertsFromDatesPrompt',
  input: {schema: GenerateAlertsFromDatesInputSchema},
  output: {schema: GenerateAlertsFromDatesOutputSchema},
  prompt: `You are an AI assistant that extracts dates from documents and generates alerts.

  Given the following document text, extract all dates that could be relevant for generating alerts (e.g., expiration dates, renewal dates, due dates).

  For each date, determine the type of date (e.g., expiration, renewal, due date) and generate a description of the event associated with the date.

  Return the dates in ISO format (YYYY-MM-DD).

  Document Text: {{{documentText}}}`, 
});

const generateAlertsFromDatesFlow = ai.defineFlow(
  {
    name: 'generateAlertsFromDatesFlow',
    inputSchema: GenerateAlertsFromDatesInputSchema,
    outputSchema: GenerateAlertsFromDatesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
