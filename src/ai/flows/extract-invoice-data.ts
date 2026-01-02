
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
  documentType: z.string().describe('Type de document (STEG, SONEDE, Maison, Internet, Assurance, Contrat, Autre).'),
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
   - PÉRIODE : Repérez "فترة الاستهلاك" (souvent en haut/milieu). Juste après, il y a un code à 4 segments type "2025-08-07-06".
   - ÉCHÉANCE (CRITIQUE) : Repérez le bloc de texte "الرجاء الدفع" ou "Prière de payer" (en bas à gauche). La date d'échéance se trouve TOUJOURS immédiatement à GAUCHE de ce texte ou juste au-dessus. Cherchez une date isolée dans le coin inférieur GAUCHE.
   - CONSOMMATION (EAU) : Cherchez "Quantité consommée" ou "Le volume consommé" en m3. Extrayez le nombre.
2. **STEG (ÉLEC/GAZ)** : 
   - RECHERCHEZ : "STEG", "الشركة التونسية للكهرباء والغاز".
   - PÉRIODE : Repérez "Du" (من) et "Au" (إلى) en haut à droite.
   - ÉCHÉANCE : Cherchez "Prière de payer avant le" (الرجاء الدفع avant le) en bas à droite.
   - CONSOMMATION (ÉLEC) : Cherchez "Consommation Électricité" ou "Total Électricité" en kWh. Extrayez le nombre.
   - CONSOMMATION (GAZ) : Cherchez "Consommation Gaz" ou "Total Gaz" en m3. Extrayez le nombre.

**RÈGLES D'EXTRACTION DES DONNÉES :**
- **documentType** : "SONEDE", "STEG", "Internet", "Recus de caisse" ou "Autre".
- **amount** : Montant Total (ex: "72.000").
- **dueDate** : Date limite (AAAA-MM-JJ). Pour SONEDE, cherchez la date isolée tout en bas à gauche, près de "الرجاء الدفع" ou "Prière de payer".
- **consumptionQuantity** : Quantité d'eau (m3) pour SONEDE, ou Électricité (kWh) pour STEG.
- **gasConsumptionQuantity** : Quantité de Gaz (m3) pour STEG.
- **billingStartDate** / **billingEndDate** : Dates de la période STEG (من / إلى).
- **consumptionPeriod** : Pour SONEDE, Format "AAAA-MM-MM-MM".

IMPORTANT : Retournez UNIQUEMENT du JSON pur. N'inventez rien. SI UNE DONNEE N'EST PAS CLAIRE, LAISSEZ LE CHAMP VIDE.`;

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