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
const getReceiptPrompt = () => {
  return `Tu es un expert en extraction de données OCR pour tous types de reçus et tickets de caisse (Carrefour Tunisie, Monoprix, MG, Géant, Aziza, pharmacie, restaurant, etc.).
Analyse cette image et extrais TOUS les produits ou services listés.

STRUCTURE TYPIQUE D'UN PRODUIT (EX: CARREFOUR) :
1. LIGNE 1 : Libellé du produit (ex: "2L EAU PRISTINE") et souvent le TOTAL de la ligne à droite (ex: "4.740d").
2. Ligne 2 : Code-barres (13 chiffres, ex: "6191467300049").
3. LIGNE 3 : Détail de la quantité et prix unitaire (ex: "6 x 0.790d").
   -> ICI, la quantité est 6 et le prix unitaire est 0.790.

RÈGLES CRITIQUES (TRÈS IMPORTANT) :
1. NE JAMAIS RÉUTILISER la quantité d'un produit précédent pour le produit suivant. 
2. Si une ligne contient "X x Y", X est TOUJOURS la quantité et Y est le prix unitaire. Extrais ces valeurs avec précision.
3. DATE (purchaseAt) : format ISO YYYY-MM-DD. N'invente jamais.
4. PRODUITS EN DOUBLE : Fusionne-les si le libellé est identique (additionne quantités et totaux).
5. CATÉGORIES :
   - Eau (Pristine, Safia, Sabrine, Melliti, Aqualine, Marwa...)
   - Boissons (Jus, Soda, Café, Thé, Delio...)
   - Frais (Lait, Yaourt, Fromage...)
   - Pâtes (Spaghetti, Macaroni, Vermicelle...)
   - Epicerie Salée (Huile, Tomate, Harissa, Farine, Semoule...)
   - Epicerie Sucrée (Biscuits, Chocolat, Chamia, Cake...)

Format de sortie JSON Strict:
{
  "storeName": "Nom de l'enseigne",
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
}`;
};

// ----- Date Parsing Helper -----
function parseFlexibleDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.toLowerCase() === 'null') return null;
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
  console.log('[Groq Receipt] Scan début (Image size:', input.receiptDataUri.length, ')');
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const prompt = getReceiptPrompt();

  const validateDate = (result: ExtractReceiptDataOutput | null) => {
    if (!result) return null;
    const rawDate = result.purchaseAt;
    const parsedDate = parseFlexibleDate(rawDate);

    if (!rawDate || !parsedDate || parsedDate >= tomorrow || parsedDate.getFullYear() < 2020) {
      result.purchaseAt = todayISO;
    } else {
      result.purchaseAt = parsedDate.toISOString().split('T')[0];
    }
    return result;
  };

  try {
    const groqRes = await extractWithGroq(input, prompt);
    if (groqRes) {
      console.log('[Groq Receipt] Extraction successful');
      const validated = validateDate(groqRes);
      return JSON.parse(JSON.stringify(validated));
    }
  } catch (err: any) {
    console.error('[Groq Receipt] Error:', err.message);
  }

  return {
    storeName: "Échec de l'analyse Groq",
    lines: [],
    ocrText: "Impossible de traiter le reçu via Groq.",
    confidence: 0,
    storeId: '',
    purchaseAt: todayISO,
    currency: 'TND',
    total: 0,
    subtotal: 0,
    taxTotal: 0,
  };
}

// Fonction supprimée, appel direct à extractWithGroq utilisé.

// Groq implementation
async function extractWithGroq(
  input: ExtractReceiptDataInput,
  prompt: string
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
          { role: 'system', content: 'Vous êtes un expert en extraction JSON de reçus et tickets de caisse multi-enseignes.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
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
