'use server';

import { z } from 'genkit';
import { ai } from '@/ai/genkit';

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

const INVOICE_PROMPT = `Vous êtes un expert en factures tunisiennes (STEG, SONEDE, Orange, Ooredoo, Topnet, GlobalNet, Tunisie Telecom, etc.).
Votre mission est d'extraire les données avec une précision chirurgicale.

**DETERMINATION DU FOURNISSEUR (CRITIQUE) :**
1. **SONEDE (EAU)** : 
   - RECHERCHEZ : "SONEDE", "الشركة الوطنية لاستغلال وتوزيع المياه", "District", "Eau potable".
   - PERIODE : Reperez "periode d'echance" ou "periode de consommation". Juste apres, il y a un code a 4 segments (AAAA-MM-MM-MM) representant l'annee et les 3 mois de consommation. Extrayez ce code EXACTEMENT. NE LE CONFONDEZ PAS avec la date d'echeance. 
   - ECHEANCE ET MONTANT (CRITIQUE) : Cherchez dans le coin inferieur GAUCHE du document (attention : ces elements sont souvent tournes de 90 degres). Reperez "Priere de payer" ou le texte en arabe correspondant. La date d'echeance est la date isolee juste a cote (ex: 2026-02-12). Le montant total (ex: 20,800) se trouve generalement juste a cote.
   - CONSOMMATION (EAU) : Cherchez "Quantite consommee", "Volume" ou "Consommation" en m3. Extrayez UNIQUEMENT le nombre (ex: "13").
2. **STEG (ELEC/GAZ)** : 
   - RECHERCHEZ : "STEG", "الشركة التونسية للكهرباء والغاز".
   - PERIODE : Reperez "Du" et "Au" en haut a droite.
   - ECHEANCE (CRITIQUE) : En bas a droite, dans le cadre de GAUCHE ("Priere de payer").
   - CONSOMMATION : Colonne 5 "Quantite (1)".

**REGLES D'EXTRACTION :**
- **documentType** : "SONEDE", "STEG", "Internet", "Recus de caisse" ou "Autre".
- **amount** : Montant Total (ex: "72.000").
- **dueDate** : Date limite (AAAA-MM-JJ).
   - Pour SONEDE : Coin inferieur gauche.
   - Pour STEG : Cadre GAUCHE en bas a droite.
- **consumptionPeriod** : Pour SONEDE, Format "AAAA-MM-MM-MM".
- **supplier** : Nom du fournisseur (ex: "STEG", "SONEDE", "Orange").
- **consumptionQuantity** : Quantite d'electricite (kWh) pour STEG, ou Volume d'eau (m3) pour SONEDE.
- **billingStartDate** / **billingEndDate** : Dates de la periode pour STEG (AAAA-MM-JJ).

IMPORTANT : Retournez UNIQUEMENT du JSON pur. N'inventez rien.
`;

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
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user', content: [
              { type: 'text', text: INVOICE_PROMPT },
              { type: 'image_url', image_url: { url: input.invoiceDataUri } }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[Groq Invoice] API Error:', response.status, errData);
      return null;
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch (e) {
    console.error('[Groq Invoice] Error:', e);
    return null;
  }
}

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<{ data?: ExtractInvoiceDataOutput; error?: string }> {
  try {
    const groqRes = await extractWithGroq(input);
    if (groqRes) {
      console.log('[Groq Invoice] Extraction successful');
      return { data: groqRes };
    }
  } catch (e: any) {
    console.warn('[Groq Invoice] Failed or timed out:', e.message);
  }

  // Fallback to Gemini 1.5 Flash
  console.log('[Gemini Invoice] Attempting fallback...');
  try {
    const result = await (ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: INVOICE_PROMPT },
        { media: { url: input.invoiceDataUri, contentType: input.mimeType || 'image/jpeg' } },
      ],
      output: { schema: ExtractInvoiceDataOutputSchema },
    }) as Promise<any>);

    if (result && result.output) {
      console.log('[Gemini Invoice] Extraction successful');
      return { data: result.output as ExtractInvoiceDataOutput };
    }
  } catch (e: any) {
    console.error('[Gemini Invoice] Fallback failed:', e.message);
    return { error: `AI Analysis failed: ${e.message}` };
  }

  return { error: "L'analyse du document a échoué. Veuillez vous assurer que le document est lisible et réessayez." };
}