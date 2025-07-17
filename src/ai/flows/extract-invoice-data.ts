
'use server';

/**
 * @fileOverview A flow to extract invoice and receipt data from images or PDFs.
 *
 * - extractInvoiceData - A function that handles the data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A data URI of the invoice or receipt image/PDF, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  supplier: z.string().describe('Le nom du fournisseur ou de l\'entité. Ex: "STEG", "SONEDE", "Orange", "Banque Zitouna", "Kiosque Ali".'),
  amount: z.string().describe('Le montant total payé ou à payer.'),
  dueDate: z.string().describe('La date de la transaction, de l\'émission ou d\'échéance au format AAAA-MM-JJ.'),
  billingStartDate: z.string().optional().describe('La date de début de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  billingEndDate: z.string().optional().describe('La date de fin de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  consumptionPeriod: z.string().optional().describe('Uniquement pour les factures SONEDE. Extrayez la période de consommation trimestrielle exactement comme elle apparaît (ex: "03-04-05-2025").'),
  reference: z.string().describe('Le numéro de référence de la facture ou de la transaction.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `Vous êtes un expert dans l'extraction de données à partir de factures et reçus tunisiens.

  Veuillez extraire les informations suivantes de l'image du document fournie :
  - Nom du fournisseur ou de l'entité : Soyez précis. Pour l'électricité, c'est "STEG". Pour l'eau, "SONEDE". Pour un reçu bancaire, le nom de la banque (ex: "Banque Zitouna"). Pour un ticket de caisse, le nom du magasin.
  - Montant : Le montant total.
  - Date : La date principale du document (date de transaction, d'échéance, etc.).
  - Numéro de référence : Le numéro de la facture, de la transaction ou du reçu.
  - Période de facturation (si applicable) : Dates de début et de fin.

  Détails spécifiques :
  1. Pour les factures SONEDE : La période de consommation est un trimestre (ex: "03-04-05-2025"). Extrayez cette chaîne exacte dans le champ "consumptionPeriod" et laissez "billingStartDate" et "billingEndDate" vides.
  2. Pour les reçus et tickets de caisse : Les périodes de facturation ne sont généralement pas applicables. Laissez ces champs vides.

  Retournez toutes les dates au format AAAA-MM-JJ.

  Voici le document :
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
