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

Instructions obligatoires:
1.  **Liste des Produits ("lines")**: Pour CHAQUE ligne de produit sur le ticket:
    -   "rawLabel": Copie EXACTEMENT le texte du libellé (exemple: "LAIT 1L D.LICE"). Si illisible, mets "Article illisible".
    -   "normalizedLabel": Corrige le libellé pour qu'il soit propre (exemple: "Lait 1L Délice").
    -   "quantity": Trouve la quantité. Si c'est un produit au poids (ex: 1.250 kg), mets 1.25. Si c'est unitaire (ex: 2 x 1.500), mets 2. Par défaut, mets 1.
    -   "unitPrice": Le prix unitaire.
    -   "lineTotal": Le montant total de la ligne.
2.  **Date ("purchaseAt")**: Cherche la date (JJ/MM/AAAA) et l'heure. Convertis en format ISO 8601 (YYYY-MM-DDTHH:mm:ss). Si introuvable, utilise la date d'aujourd'hui.
3.  **Magasin ("storeName")**: Le nom du supermarché.
4.  **Totaux**: "total", "subtotal" (si dispo).

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
NB: Ne rate AUCUN produit. Si le ticket est long, extrais tout ce que tu vois.`;

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
