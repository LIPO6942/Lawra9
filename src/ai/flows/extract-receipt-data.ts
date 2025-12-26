'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  receiptDataUri: z
    .string()
    .describe(
      "Data URI de l'image/PDF du reçu ('data:<mimetype>;base64,<encoded>')"
    ),
  mimeType: z.string().optional(),
});
export type ExtractReceiptDataInput = z.infer<typeof ExtractReceiptDataInputSchema>;

const ExtractReceiptDataOutputSchema = z.object({
  storeName: z.string().optional(),
  storeId: z.string().optional(),
  purchaseAt: z.string().optional().describe('Date/heure ISO si possible'),
  currency: z.string().optional(),
  total: z.number().optional(),
  subtotal: z.number().optional(),
  taxTotal: z.number().optional(),
  ocrText: z.string().optional(),
  confidence: z.number().optional(),
  lines: z.array(ReceiptLineSchema),
});
export type ExtractReceiptDataOutput = z.infer<typeof ExtractReceiptDataOutputSchema>;

const RECEIPT_PROMPT = `Vous êtes un expert en extraction de données de tickets de caisse, spécialisé dans les formats de supermarchés (ex: Carrefour Tunisie).

Objectif: Extraire toutes les métadonnées et TOUTES les lignes d'articles de façon structurée au format JSON.

Règles de lecture CRITIQUES pour les articles:
1. **Structure multi-lignes (Patron Carrefour)**: Un article est généralement structuré sur 3 lignes :
   - Ligne 1: [PRÉFIXE ÉVENTUEL] [LIBELLÉ DE L'ARTICLE] [MONTANT TOTAL LIGNE] (ex: "R 25CL DELIO AROMA G 11.400d")
   - Ligne 2: [CODE-BARRES] (ex: "6191534802476")
   - Ligne 3: [QUANTITÉ] x [PRIX UNITAIRE] (ex: "12 x 0.950d")
   -> Regroupez ces 3 lignes en UN SEUL objet article.

2. **Extraction des Valeurs**:
   - Supprimez le suffixe 'd' (Dinar) pour ne garder que le nombre décimal.
   - Si "Quantity x UnitPrice" est présent, utilisez-les. Sinon Quantity=1.

3. **Validation**: Calculez toujours Quantity * UnitPrice.

Structure JSON attendue:
{
  "storeName": "Nom Magasin",
  "purchaseAt": "ISO Date",
  "total": 0.0,
  "lines": [
    { "rawLabel": "...", "normalizedLabel": "...", "quantity": 1, "unitPrice": 0.0, "lineTotal": 0.0, "barcode": "..." }
  ]
}`;

const prompt = ai.definePrompt({
  name: 'extractReceiptDataPrompt',
  input: { schema: ExtractReceiptDataInputSchema },
  output: { schema: ExtractReceiptDataOutputSchema },
  prompt: RECEIPT_PROMPT,
});

async function extractWithGroq(input: ExtractReceiptDataInput): Promise<ExtractReceiptDataOutput | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.warn("[Groq] Clé API GROQ_API_KEY absente.");
    return null;
  }

  console.log("[Groq] Tentative de fallback...");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: RECEIPT_PROMPT },
              { type: "image_url", image_url: { url: input.receiptDataUri } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log("[Groq] Analyse réussie.");
      return JSON.parse(content);
    }
  } catch (e: any) {
    console.error("[Groq] Erreur fallback:", e.message);
  }
  return null;
}

export async function extractReceiptData(input: ExtractReceiptDataInput): Promise<ExtractReceiptDataOutput> {
  console.log("[Genkit] Début extractReceiptData (taille image:", input.receiptDataUri.length, ")");

  if (!input.receiptDataUri || input.receiptDataUri.length < 100) {
    return {
      storeName: "Erreur",
      lines: [],
      ocrText: "Image invalide ou trop petite."
    } as any;
  }

  // 1. Essai avec Gemini
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Gemini (20s)")), 20000)
    );

    const result = await Promise.race([
      prompt(input),
      timeoutPromise
    ]) as any;

    if (result && result.output) {
      console.log("[Gemini] Analyse réussie.");
      return JSON.parse(JSON.stringify(result.output));
    }
  } catch (geminiError: any) {
    console.warn("[Gemini] Échec/Timeout:", geminiError.message);
  }

  // 2. Essai avec Groq
  const groqRes = await extractWithGroq(input);
  if (groqRes) {
    console.log("[Groq] Retour au client.");
    return JSON.parse(JSON.stringify(groqRes));
  }

  // 3. Échec final
  return {
    storeName: "Échec de l'analyse",
    lines: [],
    ocrText: "L'IA n'a pas pu analyser ce reçu. Vérifiez la qualité de l'image ou essayez un fichier plus léger."
  } as any;
}
