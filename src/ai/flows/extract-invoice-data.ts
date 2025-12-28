
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

const INVOICE_PROMPT = `Vous êtes un expert en factures et reçus tunisiens (STEG, SONEDE, Carrefour, Monoprix, etc.). Votre mission est d'extraire les données avec une précision absolue. Retournez uniquement du JSON.

**RÈGLES D'IDENTIFICATION CRUCIALES :**
1. **SONEDE (EAU)** : SI vous voyez une période de consommation type "2025-08-07-06", documentType est "SONEDE".
2. **STEG (ÉLEC/GAZ)** : Mots clés "STEG", "KWh". DocumentType est "STEG".
3. **REÇUS DE CAISSE (SUPERMARCHÉ)** : Pour tout reçu de courses (Carrefour, Magasin Général, Monoprix, etc.), utilisez TOUJOURS "Recus de caisse" comme documentType. Ne jamais utiliser "Autre" pour ces reçus.

**FORMAT DES REÇUS (EX: CARREFOUR) :**
- Souvent, le libellé du produit est sur une ligne avec le prix total de la ligne à droite.
- La ligne JUSTE EN DESSOUS contient la quantité et le prix unitaire (ex: "6 x 0.790").
- Associez correctement ces informations pour extraire le libellé, la quantité, le prix unitaire et le total par ligne.

**CATÉGORIES DE PRODUITS :**
- SI un produit mentionne : Randa, Warda, Babbouche, Vermicelles, Spaghetti, Coquillage, Papillon, Lasagne, Fell (ou toute ressemblance), classez-le dans la catégorie "Pates".

**EXTRACTION DES CHAMPS :**
- amount: Montant total à payer. Utilisez le point décimal (ex: "24.000").
- dueDate/issueDate: AAAA-MM-JJ.

IMPORTANT: Pas de blabla, juste du JSON.`;

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
          { role: 'system', content: 'Tu es un expert en extraction JSON de factures tunisiennes (STEG/SONEDE). Restreint la sortie au JSON pur.' },
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