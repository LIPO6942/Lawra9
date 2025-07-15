
'use server';

/**
 * @fileOverview A flow to extract invoice data from images or PDFs.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A data URI of the invoice image or PDF, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  supplier: z.string().describe('Le nom du fournisseur. Doit être "STEG" pour l\'électricité, "SONEDE" pour l\'eau, ou le nom du fournisseur comme "Orange" pour les autres.'),
  amount: z.string().describe('Le montant total à payer sur la facture.'),
  dueDate: z.string().describe('La date d\'échéance de la facture au format AAAA-MM-JJ.'),
  billingStartDate: z.string().optional().describe('La date de début de la période de facturation au format AAAA-MM-JJ.'),
  billingEndDate: z.string().optional().describe('La date de fin de la période de facturation au format AAAA-MM-JJ.'),
  reference: z.string().describe('Le numéro de référence de la facture.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `Vous êtes un expert dans l'extraction de données à partir de factures tunisiennes.

  Veuillez extraire les informations suivantes de l'image de la facture fournie :
  - Nom du fournisseur : Soyez précis. Pour l'électricité, ce doit être "STEG". Pour l'eau, ce doit être "SONEDE". Pour les télécommunications, ça peut être "Orange", "Ooredoo", etc.
  - Montant : Le montant total à payer.
  - Date d'échéance : La date limite de paiement.
  - Date de début de facturation : Le début de la période de consommation.
  - Date de fin de facturation : La fin de la période de consommation.
  - Numéro de référence

  Détail important pour les factures SONEDE : La période de consommation est souvent un trimestre indiqué en haut à gauche sous un format comme "03-04-05-2025". Cela signifie Mars-Avril-Mai 2025. La date de début serait le premier jour du premier mois (01-03-2025) et la date de fin serait le dernier jour du dernier mois (31-05-2025). Interprétez cela correctement.

  Retournez toutes les dates au format AAAA-MM-JJ.

  Voici la facture :
  {{media url=invoiceDataUri}}
  `,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
