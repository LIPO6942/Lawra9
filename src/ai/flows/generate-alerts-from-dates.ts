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
  documentText: z.string().describe('Le contenu textuel du document.'),
});
export type GenerateAlertsFromDatesInput = z.infer<typeof GenerateAlertsFromDatesInputSchema>;

const GenerateAlertsFromDatesOutputSchema = z.array(z.object({
  date: z.string().describe('La date extraite au format ISO (AAAA-MM-JJ).'),
  type: z.string().describe('Le type de date (ex: expiration, renouvellement, date d\'échéance).'),
  description: z.string().describe('Une description de l\'événement associé à la date.'),
}));
export type GenerateAlertsFromDatesOutput = z.infer<typeof GenerateAlertsFromDatesOutputSchema>;

export async function generateAlertsFromDates(input: GenerateAlertsFromDatesInput): Promise<GenerateAlertsFromDatesOutput> {
  return generateAlertsFromDatesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAlertsFromDatesPrompt',
  input: {schema: GenerateAlertsFromDatesInputSchema},
  output: {schema: GenerateAlertsFromDatesOutputSchema},
  prompt: `Vous êtes un assistant IA qui extrait des dates de documents et génère des alertes.

  À partir du texte du document suivant, extrayez toutes les dates qui pourraient être pertinentes pour générer des alertes (par exemple, les dates d'expiration, de renouvellement, d'échéance).

  Pour chaque date, déterminez le type de date (par exemple, expiration, renouvellement, date d'échéance) et générez une description de l'événement associé à la date.

  Retournez les dates au format ISO (AAAA-MM-JJ).

  Texte du document : {{{documentText}}}`, 
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
