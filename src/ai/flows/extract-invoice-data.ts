
'use server';

/**
 * @fileOverview A flow to extract invoice data and detect document type from images or PDFs.
 *
 * - extractInvoiceData - A function that handles the data extraction and type detection process.
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
    mimeType: z.string().optional().describe('The MIME type of the document (e.g., "image/jpeg", "application/pdf").'),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  documentType: z.string().describe('Le type de document détecté (STEG, SONEDE, Reçu Bancaire, Maison, Internet, Assurance, Contrat, Autre).'),
  supplier: z.string().describe('Le nom du fournisseur ou de l\'entité. Ex: "STEG", "SONEDE", "Orange", "Banque Zitouna", "Kiosque Ali".'),
  amount: z.string().describe('Le montant total payé ou à payer.'),
  dueDate: z.string().optional().describe('La date d\'échéance au format AAAA-MM-JJ. Laisser vide si non applicable.'),
  issueDate: z.string().optional().describe("La date d'émission du document au format AAAA-MM-JJ."),
  invoiceNumber: z.string().optional().describe("Le numéro de la facture."),
  billingStartDate: z.string().optional().describe('La date de début de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  billingEndDate: z.string().optional().describe('La date de fin de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  consumptionPeriod: z.string().optional().describe('Uniquement pour les factures SONEDE. Extrayez la période de consommation trimestrielle exactement comme elle apparaît (ex: "03-04-05-2025").'),
  consumptionQuantity: z.string().optional().describe("La quantité consommée (ex: '150 KWh', '75 m³'). Inclure l'unité si possible. Laisser vide si non applicable."),
  reference: z.string().optional().describe('Le numéro de référence de la facture ou de la transaction.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `Vous êtes un expert dans l'analyse de documents et factures tunisiens. Votre tâche est de détecter le type de document ET d'en extraire les informations pertinentes.

  **Étape 1 : Détection du type de document**
  Identifiez d'abord le type du document parmi les choix suivants : STEG (facture d'électricité), SONEDE (facture d'eau), Reçu Bancaire (reçu de retrait, de dépôt, etc.), Maison (contrat de location, titre de propriété), Internet (facture de fournisseur d'accès comme Orange, Ooredoo, Topnet), Assurance, Contrat, ou Autre. Renseignez le champ "documentType".

  **Étape 2 : Extraction des données**
  Veuillez extraire les informations suivantes de l'image du document fournie et renseignez les autres champs :
  - Nom du fournisseur ou de l'entité : Soyez précis. Si le document mentionne "Société Tunisienne de l'Electricité et du Gaz", le fournisseur DOIT être "STEG". Pour l'eau, c'est "SONEDE". Pour un reçu bancaire, le nom de la banque (ex: "Banque Zitouna"). Pour un ticket de caisse, le nom du magasin.
  - Montant : Le montant total.
  - Date d'échéance : La date limite de paiement.
  - Date d'émission : La date à laquelle le document a été créé.
  - Numéro de facture : Le numéro d'identification de la facture.
  - Période de facturation (si applicable) : Dates de début et de fin.
  - Quantité consommée (pour STEG/SONEDE) : Cherchez le mot "الكمية" et extrayez la valeur numérique et son unité (ex: KWh, m³).

  **Détails spécifiques :**
  1. Pour les factures SONEDE : La période de consommation est un trimestre (ex: "03-04-05-2025"). Extrayez cette chaîne exacte dans le champ "consumptionPeriod" et laissez "billingStartDate" et "billingEndDate" vides.
  2. Pour les reçus et tickets de caisse : Les périodes de facturation et la quantité consommée ne sont généralement pas applicables. Laissez ces champs vides.

  Retournez toutes les dates au format AAAA-MM-JJ.

  Voici le document :
  {{media url=invoiceDataUri mimeType=mimeType}}
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
       {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
       {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
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
