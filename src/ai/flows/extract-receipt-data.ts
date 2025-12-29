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
const RECEIPT_PROMPT = `Tu es un expert en extraction de donnés OCR pour reçus tunisiens (Carrefour Tunisie, etc.).
Analyse cette image et extrais TOUS les produits listés, ligne par ligne.

CATÉGORIES ATTENDUES (SOIS PRÉCIS) :
- Eau (Toute marque d'eau minérale : Sabrine, Safia, Melliti, Aqualine...)
- Boissons (Jus, Soda, Café, Thé, Delio, Schweppes...)
- Frais (Lait, Yaourt, Fromage, Oeufs, Beurre...)
- Pâtes (Spaghetti, Macaroni, Couscous...)
- Epicerie Salée (Huile, Tomate, Harissa, Thon, Riz, Farine, Sel...)
- Epicerie Sucrée (Biscuits, Gaufres, Chocolat, Chamia, Confiture...)
- Fruits & Légumes (Pommes, Bananes, Oignons, Pommes de terre...)
- Boulangerie & Pâtisserie (Pain, Baguettes, Croissants...)
- Boucherie & Volaille (Viande, Poulet, Salami...)
- Hygiène & Soin (Savon, Shampoing, Dentifrice, Coton...)
- Entretien (Lessive, Javel, Liquide Vaisselle...)
- Maison & Divers (Piles, Ampoules, Ustensiles...)

RÈGLES CRITIQUES :
1. DATE PAR DÉFAUT : Si tu ne trouves pas de date sur le reçu, utilise IMPÉRATIVEMENT la date d'aujourd'hui (${new Date().toISOString().split('T')[0]}). C'est crucial.
2. NE JAMAIS utiliser la catégorie "Recus de caisse" ou "Document".
3. Si un produit est ambigu, utilise "Alimentation / Divers". Minimise son utilisation.
4. DELIO doit être dans "Boissons", mais l'EAU doit être dans sa propre catégorie "Eau".
5. ATTENTION AU FORMAT CARREFOUR :
   - Le libellé du produit est sur une ligne, le PRIX TOTAL de la ligne est souvent aligné à droite de cette même ligne.
   - Si quantité > 1, elle est sur la ligne EN-DESSOUS : "Qté x PrixUnit" (ex: "2 x 0.850").
   - Regroupe ces lignes en UN SEUL produit.

Format de sortie JSON Strict:
{
  "storeName": "string",
  "purchaseAt": "ISO date string",
  "total": number,
  "lines": [
    {
      "rawLabel": "string",
      "normalizedLabel": "string",
      "category": "string",
      "quantity": number,
      "unitPrice": number,
      "lineTotal": number
    }
  ]
}

EXEMPLE (Ne te trompe pas):
Ligne:  370G LAIT CONC       7.900   -> { "rawLabel": "370G LAIT CONC", "category": "Frais", "quantity": 1, "unitPrice": 7.900, "lineTotal": 7.900 }
Ligne:  25CL DELIO AROMA    11.400   
Ligne:      12   x   0.950           -> { "rawLabel": "25CL DELIO AROMA", "category": "Boissons", "quantity": 12, "unitPrice": 0.950, "lineTotal": 11.400 }`;

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
