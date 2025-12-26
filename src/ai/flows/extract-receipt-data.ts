'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ----- Schemas -----
const ReceiptLineSchema = z.object({
  id: z.string().describe('ID unique de la ligne'),
  rawLabel: z.string().describe('Libellé tel que sur le reçu'),
  normalizedLabel: z.string().optional().describe('Libellé normalisé'),
  category: z.string().optional().describe('Catégorie produit (taxonomie définie)'),
  quantity: z.number().optional().describe('Quantité achetée'),
  unit: z.string().optional().describe('Unité (ex: pcs, kg, L)'),
  unitPrice: z.number().optional().describe('Prix unitaire'),
  lineTotal: z.number().optional().describe('Montant de la ligne'),
  vatRate: z.number().optional().describe('TVA %'),
  barcode: z.string().optional().describe('Code-barres si présent'),
});

const ExtractReceiptDataInputSchema = z.object({
  receiptDataUri: z.string(),
  mimeType: z.string().optional(),
});
export type ExtractReceiptDataInput = z.infer<typeof ExtractReceiptDataInputSchema>;

const ExtractReceiptDataOutputSchema = z.object({
  storeName: z.string().optional(),
  storeId: z.string().optional(),
  purchaseAt: z.string().optional(),
  currency: z.string().optional(),
  total: z.number().optional(),
  subtotal: z.number().optional(),
  taxTotal: z.number().optional(),
  lines: z.array(ReceiptLineSchema),
  ocrText: z.string().optional(),
  confidence: z.number().optional(),
});
export type ExtractReceiptDataOutput = z.infer<typeof ExtractReceiptDataOutputSchema>;

// ----- Prompt -----
const RECEIPT_PROMPT = `Tu es un expert en extraction de donnés OCR pour reçus tunisiens (Carrefour, Monoprix, MG, etc.).
Analyse cette image et extrais TOUS les produits listés, ligne par ligne.

ATTENTION AU FORMAT CARREFOUR :
- Le libellé du produit est sur une ligne, le PRIX TOTAL de la ligne est souvent aligné à droite de cette même ligne.
- S'il y a une quantité > 1, elle est souvent indiquée sur la ligne EN-DESSOUS du libellé, sous la forme "Quantité x Prix Unitaire" (ex: "2 x 0.850").
- Dans ce cas (multi-ligne):
    *   Quantité = le premier chiffre (ex: 2).
    *   Prix Unitaire = le deuxième chiffre (ex: 0.850).
    *   Total Ligne = le montant à droite de la PREMIÈRE ligne (celle du libellé).
    *   Vérification : Quantité x Prix Unitaire ≈ Total Ligne.
- Si tout est sur une seule ligne (Quantité = 1), le Prix Unitaire = Total Ligne = le montant à droite.

Instructions obligatoires:
1.  **Liste des Produits ("lines")**: Pour CHAQUE article:
    -   "rawLabel": Texte du libellé (ex: "25CL DELIO AROMA G").
    -   "normalizedLabel": Libellé propre (ex: "25cl Delio Aroma Gaz").
    -   "quantity": La quantité achetée (par défaut 1).
    -   "unitPrice": Le prix unitaire.
    -   "lineTotal": Le montant total payé pour cet article.
2.  **Date ("purchaseAt")**: Format ISO 8601 (YYYY-MM-DDTHH:mm:ss).
3.  **Magasin ("storeName")**: Le nom du supermarché.
4.  **Totaux**: "total", "subtotal".

Format de sortie JSON Strict:
{
  "storeName": "string",
  "purchaseAt": "ISO date string",
  "total": number,
  "lines": [
    {
      "rawLabel": "string",
      "normalizedLabel": "string",
      "quantity": number,
      "unitPrice": number,
      "lineTotal": number
    }
  ]
}

EXEMPLE CONCRET (Ce que tu vois -> Ce que tu dois extraire):
IMAGE:
  25CL DELIO AROMA G        11.400
      12  x   0.950

JSON ATTENDU:
  {
    "rawLabel": "25CL DELIO AROMA G",
    "quantity": 12,
    "unitPrice": 0.950,
    "lineTotal": 11.400
  }

IMPORTANT:
1. LIGNES MULTIPLES: Si tu vois "X x Y" (ex: "12 x 0.950"), mets "12" dans quantity et "0.950" dans unitPrice de l'article JUSTE AU-DESSUS.
2. DATE: La date est souvent en bas du ticket (ex: "26/12/2024"). Cherche bien partout. Si tu trouves "26/12/2024", RENVOIE "2024-12-26T12:00:00". Si tu ne trouves PAS la date, renvoie null (ne n'invente pas).`;

// ----- Helper: Groq with timeout -----
async function extractWithGroqTimeout(
  input: ExtractReceiptDataInput,
  timeoutMs: number = 240000
): Promise<ExtractReceiptDataOutput | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await extractWithGroq(input);
    return result;
  } catch (e) {
    if ((e as any).name === 'AbortError') {
      console.warn('[Groq] Timeout after', timeoutMs, 'ms');
    } else {
      console.warn('[Groq] Exception:', e);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ----- Original Groq implementation -----
async function extractWithGroq(
  input: ExtractReceiptDataInput
): Promise<ExtractReceiptDataOutput | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error('[Groq] GROQ_API_KEY is missing in env');
    return null;
  }

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
          { role: 'system', content: 'Vous êtes un expert en extraction JSON de reçus Carrefour Tunisie.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: RECEIPT_PROMPT },
              { type: 'image_url', image_url: { url: input.receiptDataUri } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Groq] API Error Status:', response.status, errBody);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        ocrText: parsed.ocrText || 'Extrait par Groq',
        confidence: parsed.confidence || 0.8,
      };
    }
  } catch (e) {
    console.error('[Groq] Exception during fetch:', e);
  }
  return null;
}

// ----- Main extraction flow -----
export async function extractReceiptData(
  input: ExtractReceiptDataInput
): Promise<ExtractReceiptDataOutput> {
  console.log('[Genkit] Scan début (Image size:', input.receiptDataUri.length, ')');

  // 1️⃣ Prioritize Groq (240 s timeout) - Using Llama-4 Scout for OCR
  try {
    const groqRes = await extractWithGroqTimeout(input);
    if (groqRes) {
      console.log('[Groq] Succès (prioritaire).');
      return JSON.parse(JSON.stringify(groqRes));
    }
  } catch (err: any) {
    console.warn('[Groq] Échec:', err.message);
  }

  // 2️⃣ Fallback to Gemini (4 minutes timeout)
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('[Gemini] API Key missing (GOOGLE_API_KEY), skipping Gemini.');
  } else {
    try {
      const geminiPromise = ai.generate({
        model: 'googleai/gemini-1.5-flash',
        prompt: [
          { text: RECEIPT_PROMPT },
          { media: { url: input.receiptDataUri, contentType: input.mimeType || 'image/jpeg' } },
        ],
        output: { schema: ExtractReceiptDataOutputSchema },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Gemini (4 minutes)')), 240000)
      );

      const result = await (Promise.race([geminiPromise, timeoutPromise]) as Promise<any>);
      if (result && result.output) {
        console.log('[Gemini] Succès.');
        return JSON.parse(JSON.stringify(result.output));
      }
    } catch (err: any) {
      console.warn('[Gemini] Échec/Timeout:', err.message);
    }
  }

  // 3️⃣ Ultimate fallback – return empty structure
  return {
    storeName: "Échec de l'analyse",
    lines: [],
    ocrText: "L'IA n'a pas pu répondre à temps. Réessayez avec une image plus petite ou vérifiez vos clés API.",
    confidence: 0,
    storeId: '',
    purchaseAt: new Date().toISOString(),
    currency: 'TND',
    total: 0,
    subtotal: 0,
    taxTotal: 0,
  };
}
