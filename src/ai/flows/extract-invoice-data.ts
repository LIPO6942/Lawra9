
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

const INVOICE_PROMPT = `Vous êtes un expert en factures tunisiennes (STEG, SONEDE, Orange, Ooredoo, Topnet, etc.).
Votre mission est d'extraire les données avec une précision chirurgicale.

**DÉTERMINATION DU FOURNISSEUR (CRITIQUE) :**
1. **SONEDE (EAU)** : 
   - RECHERCHEZ : "SONEDE", "الشركة الوطنية لاستغلال وتوزيع المياه", "District", "Eau potable".
   - PÉRIODE : Repérez "فترة الاستهلاك". Juste après, il y a un code à 4 segments type "2025-08-07-06".
   - ÉCHÉANCE : Cherchez "الرجاء الدفع قبل هذا التاريخ" ou une date isolée en bas à gauche.
2. **STEG (ÉLEC/GAZ)** : 
   - RECHERCHEZ : "STEG", "Société Tunisienne de l'Electricité et du Gaz", "الشركة التونسية للكهرباء والغاز".
   - PÉRIODE : Repérez "Du" (من) et "Au" (إلى) en haut à droite.
   - ÉCHÉANCE (ATTENTION) : Cherchez "Prière de payer avant le" (الرجاء الدفع قبل). C'est la date limite (ex: 2025.12.11). 
   - IGNOREZ impérativement la date du prochain relevé "Prochain relevé d'index" (التاريخ المقبل لقراءة العداد) qui est souvent plus tardive (ex: 2026.03.17).

**RÈGLES D'EXTRACTION DES DONNÉES :**
- **documentType** : "SONEDE", "STEG", "Internet", "Reçu Bancaire", "Recus de caisse" ou "Autre".
- **amount** : Montant Total TTC à payer (ex: "72.000").
- **dueDate** : Date limite de paiement (AAAA-MM-JJ). SOUVENT EN BAS À DROITE POUR STEG, au-dessus de "الرجاء الدفع قبل".
- **billingStartDate** / **billingEndDate** : Dates de la période STEG (من / إلى).
- **consumptionPeriod** : 
  - Pour SONEDE : Format "AAAA-MM-MM-MM".
  - Pour les autres : "Mois Année" ou laissez vide si billingStartDate/EndDate sont présents.

IMPORTANT : Retournez UNIQUEMENT du JSON pur. N'inventez rien. SI UNE DATE N'EST PAS CLAIRE, LAISSEZ LE CHAMP VIDE.`;

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