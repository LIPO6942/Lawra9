
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

const INVOICE_PROMPT = `Vous êtes un expert dans l'analyse de factures tunisiennes (STEG, SONEDE, etc.). Votre tâche consiste à extraire les données en JSON avec une précision chirurgicale.

**DÉTECTION DU TYPE :**
1. **STEG (ÉLECTRICITÉ/GAZ)** : Reconnaissable au logo bleu/rouge/gris, au texte "Société Tunisienne de l'Electricité et du Gaz" ou "الشركة التونسية للكهرباء والغاز".
   - **Montant à payer** : C'est le montant final (souvent dans une case rouge en bas à gauche, libellé "Montant à payer" ou "المبلغ المطلوب").
   - **Date d'échéance** : Cherchez "Prière de payer avant le" ou "الرجاء الدفع قبل" (format AAAA-MM-JJ).
   - **Électricité** : Extrayez la quantité (ex: 501 KWh) dans "consumptionQuantity".
   - **Gaz** : Si présent, extrayez le montant total gaz dans "gasAmount" et la quantité dans "gasConsumptionQuantity" (ex: "19 m3").
2. **SONEDE (EAU)** : Reconnaissable au format de période "AAAA-MM-MM-MM" (ex: 2025-08-07-06) et au libellé "إستهلاك الماء".

**CHAMPS JSON :**
- documentType: "STEG", "SONEDE", "Internet", etc.
- supplier: Nom du fournisseur.
- amount: Montant total à payer.
- dueDate: Date d'échéance (AAAA-MM-JJ).
- issueDate: Date d'émission (AAAA-MM-JJ).
- billingStartDate/billingEndDate: Début et fin de période.
- consumptionQuantity: Quantité électricité ou eau.
- gasAmount: Montant spécifique gaz (pour STEG).
- gasConsumptionQuantity: Quantité gaz (pour STEG).

IMPORTANT: Retournez uniquement du JSON. Dates en AAAA-MM-JJ.`;

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