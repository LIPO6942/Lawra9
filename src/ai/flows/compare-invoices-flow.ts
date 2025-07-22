
'use server';

/**
 * @fileOverview A flow to compare two invoices and highlight their differences.
 *
 * - compareInvoices - A function that handles the comparison process.
 * - CompareInvoicesInput - The input type for the compareInvoices function.
 * - CompareInvoicesOutput - The return type for the compareInvoices function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CompareInvoicesInputSchema = z.object({
  invoice1DataUri: z
    .string()
    .describe(
      "The first invoice document as a data URI, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  invoice2DataUri: z
    .string()
    .describe(
      "The second invoice document as a data URI, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
    invoice1Name: z.string().describe("The name or identifier for the first invoice."),
    invoice2Name: z.string().describe("The name or identifier for the second invoice."),
});
export type CompareInvoicesInput = z.infer<typeof CompareInvoicesInputSchema>;

const CompareInvoicesOutputSchema = z.object({
  costDifference: z.string().optional().describe("La différence de coût entre les deux factures, en TND. Précisez si c'est une augmentation ou une diminution. Ex: '+15,300 TND' ou '-5,120 TND'"),
  consumptionDifference: z.string().optional().describe("La différence de consommation (ex: électricité, eau, gaz). Précisez l'unité et le signe. Ex: '+40 kWh' ou '-10 m³'"),
  period1: z.string().optional().describe("La période ou la date de la première facture."),
  period2: z.string().optional().describe("La période ou la date de la deuxième facture."),
  summary: z.string().describe("Un résumé textuel de 1 ou 2 phrases expliquant la raison de la différence de coût, basé UNIQUEMENT sur les chiffres de consommation. Ex: 'La différence de coût est due à une hausse de la consommation d'électricité de 25 kWh.'"),
});
export type CompareInvoicesOutput = z.infer<typeof CompareInvoicesOutputSchema>;

export async function compareInvoices(input: CompareInvoicesInput): Promise<CompareInvoicesOutput> {
  return compareInvoicesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'compareInvoicesPrompt',
  input: {schema: CompareInvoicesInputSchema},
  output: {schema: CompareInvoicesOutputSchema},
  prompt: `Vous êtes un analyste financier expert. Votre tâche est de comparer deux factures de manière factuelle et basée sur les chiffres.

  Facture 1 (Nom: {{{invoice1Name}}}):
  {{media url=invoice1DataUri}}
  
  Facture 2 (Nom: {{{invoice2Name}}}):
  {{media url=invoice2DataUri}}

  Instructions :
  1.  **Extraire les Périodes** : Identifiez la date ou la période de facturation pour chaque facture et placez-les dans les champs 'period1' et 'period2'.
  2.  **Calculer la Différence de Coût** : Calculez la différence de montant total entre la Facture 2 et la Facture 1. Le résultat doit être dans 'costDifference'. Utilisez un '+' pour une augmentation et un '-' pour une diminution.
  3.  **Calculer la Différence de Consommation** : Si applicable, calculez la différence de consommation chiffrée (kWh, m³, etc.) entre les deux. Le résultat doit être dans 'consumptionDifference'. Soyez précis (ex: '+40 kWh').
  4.  **Rédiger un Résumé Factuel** : Rédigez un résumé concis (1 phrase) dans 'summary' pour expliquer la cause de la variation du montant en vous basant **UNIQUEMENT** sur les différences de consommation que vous avez calculées.
      - **NE PAS spéculer** ou deviner les raisons (pas de "peut être dû à...", "des changements dans les tarifs").
      - **Être direct** : "La principale différence vient d'une augmentation de la consommation d'électricité de X kWh." ou "La différence de coût s'explique par une baisse de la consommation de gaz de Y m³."
      - Si aucune donnée de consommation n'est disponible, indiquez simplement "Aucune donnée de consommation disponible pour justifier la différence."
  
  Analysez les deux documents et remplissez les champs de sortie en suivant ces instructions à la lettre.`,
});

const compareInvoicesFlow = ai.defineFlow(
  {
    name: 'compareInvoicesFlow',
    inputSchema: CompareInvoicesInputSchema,
    outputSchema: CompareInvoicesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
