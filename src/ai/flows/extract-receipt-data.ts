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
const RECEIPT_PROMPT = `Tu es un expert en extraction de donnés OCR pour reçus tunisiens (Carrefour Tunisie, Monoprix, etc.).
Analyse cette image et extrais TOUS les produits listés.

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
- Maison & Divers (Piles, Ampoule, Ustensiles...)

RÈGLES CRITIQUES (TRÈS IMPORTANT) :
1. DATE : Extraits la date du ticket (cherches-la partout). Format ISO YYYY-MM-DD.
   - ATTENTION : Si la date extraite semble fausse ou future (ex: 2029), utilise la date d'aujourd'hui (${new Date().toISOString().split('T')[0]}).
2. FORMAT CARREFOUR (MULTI-LIGNES) :
   - Ligne 1 : "LIBELLÉ PRODUIT" (à gauche) et "TOTAL PRIX" (à droite).
   - Ligne 2 (en-dessous) : Parfois "Quantité x PrixUnit" (ex: "12 x 0.950").
   - RÈGLE D'OR : La ligne de quantité (Ligne 2) appartient TOUJOURS au produit situé JUSTE AU-DESSUS (Ligne 1). 
   - NE JAMAIS l'attribuer au produit qui suit.
3. CATÉGORIES :
   - "Alimentation / Divers" est le dernier recours.
   - "Delio" -> Boissons. 
   - "Eau Pristine/Sabrine" -> Eau.
4. CALCUL : Si Qté > 1 est indiquée, \`lineTotal\` doit correspondre à \`quantity * unitPrice\`.

Format de sortie JSON:
{
  "storeName": "string",
  "purchaseAt": "YYYY-MM-DD",
  "total": number,
  "lines": [
    {
      "rawLabel": "string",
      "category": "string",
      "quantity": number,
      "unitPrice": number,
      "lineTotal": number
    }
  ]
}

EXEMPLE (Ne te trompe pas):
Vu sur Image:
  25CL DELIO AROMA G        11.400
      12  x   0.950
Extrait:
  { "rawLabel": "25CL DELIO AROMA G", "category": "Boissons", "quantity": 12, "unitPrice": 0.950, "lineTotal": 11.400 }`;

// ----- Date Parsing Helper -----
function parseFlexibleDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();

  // ISO (YYYY-MM-DD)
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime()) && cleanStr.includes('-') && cleanStr.split('-')[0].length === 4) {
    return d;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmh = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmh) {
    const day = parseInt(dmh[1], 10);
    const month = parseInt(dmh[2], 10) - 1;
    const year = parseInt(dmh[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // DD/MM/YY
  const dmy = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    year += (year > 50 ? 1900 : 2000);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  const lastResort = new Date(cleanStr);
  return isNaN(lastResort.getTime()) ? null : lastResort;
}

// ----- Main extraction flow -----
export async function extractReceiptData(
  input: ExtractReceiptDataInput
): Promise<ExtractReceiptDataOutput> {
  console.log('[Genkit] Scan début (Image size:', input.receiptDataUri.length, ')');
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const todayISO = now.toISOString();

  const validateDate = (result: ExtractReceiptDataOutput | null) => {
    if (!result) return null;
    const parsedDate = parseFlexibleDate(result.purchaseAt);
    if (!parsedDate || parsedDate >= tomorrow) {
      console.warn('[Validation] Date invalide ou futuriste detectée:', result.purchaseAt, '-> Remplacée par:', todayISO);
      result.purchaseAt = todayISO;
    } else {
      result.purchaseAt = parsedDate.toISOString();
    }
    return result;
  };

  try {
    const groqRes = await extractWithGroqTimeout(input);
    if (groqRes) {
      console.log('[Groq] Succès.');
      const validated = validateDate(groqRes);
      return JSON.parse(JSON.stringify(validated));
    }
  } catch (err: any) {
    console.warn('[Groq] Échec:', err.message);
  }

  if (!process.env.GOOGLE_API_KEY) {
    console.warn('[Gemini] API Key missing.');
  } else {
    try {
      const result = await (ai.generate({
        model: 'googleai/gemini-1.5-flash',
        prompt: [
          { text: RECEIPT_PROMPT },
          { media: { url: input.receiptDataUri, contentType: input.mimeType || 'image/jpeg' } },
        ],
        output: { schema: ExtractReceiptDataOutputSchema },
      }) as Promise<any>);
      if (result && result.output) {
        console.log('[Gemini] Succès.');
        const validated = validateDate(result.output);
        return JSON.parse(JSON.stringify(validated));
      }
    } catch (err: any) {
      console.warn('[Gemini] Échec/Timeout:', err.message);
    }
  }

  return {
    storeName: "Échec de l'analyse",
    lines: [],
    ocrText: "L'IA n'a pas pu répondre à temps.",
    confidence: 0,
    storeId: '',
    purchaseAt: todayISO,
    currency: 'TND',
    total: 0,
    subtotal: 0,
    taxTotal: 0,
  };
}

// Helper: Groq with timeout
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
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Groq implementation
async function extractWithGroq(
  input: ExtractReceiptDataInput
): Promise<ExtractReceiptDataOutput | null> {
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

    if (!response.ok) return null;

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
    console.error('[Groq] Exception:', e);
  }
  return null;
}
