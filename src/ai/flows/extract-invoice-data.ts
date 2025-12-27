
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

**DÉTECTION DU TYPE & FOURNISSEUR :**
1. **SONEDE (EAU)** : 
   - Fournisseur: "SONEDE". Période: format "AAAA-MM-MM-MM".
2. **STEG (ÉLEC/GAZ)** : 
   - Fournisseur: "STEG".
   - **DANGER HALLUCINATION** : Ne supposez JAMAIS que la facture est payée.
   - **DATE D'ÉCHÉANCE (CRUCIAL)** : Cherchez exclusivement "Prière de payer avant le" ou "الرجاء الدفع قبل" située juste au-dessus du coupon de versement. 
   - **ATTENTION** : Ne confondez PAS avec "Prochain relevé" (qui est souvent en 2026). La date d'échéance est imminente (ex: déc/janv).

**CHAMPS JSON :**
- documentType: "STEG", "SONEDE", etc.
- supplier: "STEG", "SONEDE", etc.
- amount: Montant total final à payer en Dinars Tunisiens (TND). **IMPORTANT** : Utilisez TOUJOURS le point comme séparateur décimal (ex: "24.500"). Ne retournez JAMAIS de montant sans séparateur (ex: "24500" pour 24DT est interdit).
- dueDate: Date d'échéance EXACTE (AAAA-MM-JJ). Priorité absolue à "Prière de payer avant le".
- consumptionPeriod: Pour SONEDE, format EXACT "AAAA-MM-MM-MM".

**CONSIGNE MONTANT** : Si vous lisez "24 350" ou "24,350", écrivez "24.350". Si vous voyez des millimes comme "24350" sans virgule, convertissez en "24.350".

IMPORTANT: JSON uniquement. Pas de blabla. Pas d'hallucinations sur le statut de paiement.`;

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