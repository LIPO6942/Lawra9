
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A data URI of the invoice or receipt image/PDF, that must include a MIME type and use Base64 encoding."
    ),
  mimeType: z.string().optional(),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  documentType: z.string().describe('Type de document (STEG, SONEDE, Reçu Bancaire, Maison, Internet, Assurance, Contrat, Autre).'),
  supplier: z.string().describe('Fournisseur (ex: STEG, SONEDE, Orange).'),
  amount: z.string().describe('Montant total.'),
  dueDate: z.string().optional().describe('Date d\'échéance AAAA-MM-JJ.'),
  issueDate: z.string().optional().describe('Date d\'émission AAAA-MM-JJ.'),
  invoiceNumber: z.string().optional(),
  billingStartDate: z.string().optional(),
  billingEndDate: z.string().optional(),
  consumptionPeriod: z.string().optional(),
  consumptionQuantity: z.string().optional(),
  gasAmount: z.string().optional(),
  gasConsumptionQuantity: z.string().optional(),
  reference: z.string().optional(),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

const INVOICE_PROMPT = `Vous êtes un expert dans l'analyse de documents et factures tunisiens. Votre tâche est de détecter le type de document ET d'en extraire les informations pertinentes.

**Étape 1 : Détection du type de document**
Identifiez d'abord le type du document parmi les choix suivants : STEG, SONEDE, Reçu Bancaire, Maison, Internet, Assurance, Contrat, ou Autre.

**Étape 2 : Extraction des données**
Veuillez extraire les informations suivantes de l'image :
- Nom du fournisseur : Si le document mentionne "Société Tunisienne de l'Electricité et du Gaz", le fournisseur DOIT être "STEG". Pour l'eau, c'est "SONEDE".
- Montant : Le montant total à payer.
- Date d'échéance : Cherchez activement "آخر أجل للدفع" ou "الرجاء الدفع قبل". C'est crucial.
- Dates : Date d'émission et période de facturation.
- STEG Spécifique : Champ "amount" = total. consommation électricité dans "consumptionQuantity". Si Gaz existe, montant gaz dans "gasAmount" et quantité dans "gasConsumptionQuantity".
- SONEDE Spécifique : Période trimestrielle (ex: 03-04-05-2025) dans "consumptionPeriod". Quantité eau en m³ dans "consumptionQuantity".

Retournez JSON uniquement au format AAAA-MM-JJ pour les dates.`;

async function extractWithGroq(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: 'Tu es un expert en extraction JSON de factures (STEG/SONEDE).' },
          {
            role: 'user',
            content: [
              { type: 'text', text: INVOICE_PROMPT },
              { type: 'image_url', image_url: { url: input.invoiceDataUri } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch (e) {
    console.error('[Groq Invoice] Error:', e);
    return null;
  }
}

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  // 1. Try Groq (Preferred)
  const groqRes = await extractWithGroq(input);
  if (groqRes) return groqRes;

  // 2. Fallback to Gemini
  try {
    const result = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: INVOICE_PROMPT },
        { media: { url: input.invoiceDataUri, contentType: input.mimeType || 'image/jpeg' } },
      ],
      output: { schema: ExtractInvoiceDataOutputSchema },
    });
    if (result.output) return result.output;
    throw new Error("No output from Gemini");
  } catch (err: any) {
    throw new Error(`Analyse IA impossible: ${err.message}`);
  }
}