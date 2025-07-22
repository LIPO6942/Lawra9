
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
  amount: z.string().describe('Le montant total à payer. Pour la STEG, c\'est le montant total (électricité + gaz).'),
  dueDate: z.string().optional().describe('La date d\'échéance au format AAAA-MM-JJ. Laisser vide si non applicable.'),
  issueDate: z.string().optional().describe("La date d'émission du document au format AAAA-MM-JJ."),
  invoiceNumber: z.string().optional().describe("Le numéro de la facture."),
  billingStartDate: z.string().optional().describe('La date de début de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  billingEndDate: z.string().optional().describe('La date de fin de la période de facturation au format AAAA-MM-JJ. Laisser vide si non applicable (ex: reçu).'),
  consumptionPeriod: z.string().optional().describe('Uniquement pour les factures SONEDE. Extrayez la période de consommation trimestrielle exactement comme elle apparaît (ex: "03-04-05-2025").'),
  consumptionQuantity: z.string().optional().describe("La quantité d'électricité ou d'eau consommée (ex: '150 KWh', '75 m³'). Inclure l'unité. Laisser vide si non applicable."),
  gasAmount: z.string().optional().describe('Uniquement pour STEG. Le montant total de la rubrique Gaz, si elle existe.'),
  gasConsumptionQuantity: z.string().optional().describe('Uniquement pour STEG. La quantité de gaz consommée (ex: "50 m³"), si elle existe. Inclure l'unité.'),
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
  Identifiez d'abord le type du document parmi les choix suivants : STEG, SONEDE, Reçu Bancaire, Maison, Internet, Assurance, Contrat, ou Autre.

  **Étape 2 : Extraction des données**
  Veuillez extraire les informations suivantes de l'image du document fournie.
  - Nom du fournisseur : Si le document mentionne "Société Tunisienne de l'Electricité et du Gaz", le fournisseur DOIT être "STEG". Pour l'eau, c'est "SONEDE". Pour un reçu bancaire, le nom de la banque (ex: "Banque Zitouna").
  - Montant : Le **montant total à payer**. C'est l'information la plus importante. Pour la STEG, c'est le montant global (électricité + gaz).
  - Dates : Date d'échéance, d'émission, et période de facturation si applicable.
  - Numéros : Numéro de facture, référence.

  **Détails spécifiques par type :**
  1. **Factures STEG** :
     - Le champ "amount" doit être le montant TOTAL de la facture.
     - Cherchez la consommation d'**électricité**. Repérez le libellé "Quantité" ou "الكمية" dans la rubrique électricité. Extrayez la valeur numérique ET son unité (ex: 150 KWh) dans "consumptionQuantity". NE PAS confondre avec le montant en dinars.
     - **IMPORTANT** : Cherchez une rubrique distincte pour le **Gaz**. Si elle existe, extrayez le montant total du gaz dans "gasAmount". Puis, repérez le libellé "Quantité" ou "الكمية" dans la rubrique gaz. Extrayez la valeur numérique et son unité (ex: 50 m³) dans "gasConsumptionQuantity". NE PAS confondre avec le montant en dinars. Si la rubrique Gaz n'existe pas, laissez ces deux champs vides.
  2. **Factures SONEDE** :
     - La consommation est trimestrielle (ex: "03-04-05-2025"). Extrayez cette chaîne exacte dans "consumptionPeriod".
     - Extrayez la quantité d'eau consommée en m³ (champ "Quantité") dans "consumptionQuantity".
  3. **Reçus et tickets de caisse** : Les champs de consommation, période, etc., ne sont généralement pas applicables.

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
