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

export async function extractReceiptData(input: ExtractReceiptDataInput): Promise<ExtractReceiptDataOutput> {
  return extractReceiptDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractReceiptDataPrompt',
  input: { schema: ExtractReceiptDataInputSchema },
  output: { schema: ExtractReceiptDataOutputSchema },
  prompt: `Vous êtes un expert en extraction de données de tickets de caisse, spécialisé dans les formats de supermarchés (ex: Carrefour Tunisie).

Objectif: Extraire toutes les métadonnées et TOUTES les lignes d'articles de façon structurée.

Règles de lecture CRITIQUES pour les articles:
1. **Liaison multi-lignes (Patron Carrefour)**: Un article est souvent réparti sur 2 ou 3 lignes consécutives:
   - Ligne 1: [LIBELLÉ DE L'ARTICLE] [MONTANT TOTAL DE LA LIGNE] (ex: "DELIO AROMA G 11.400d")
   - Ligne 2 (optionnelle): [CODE-BARRES] (ex: "6191534802476")
   - Ligne 3: [QUANTITÉ] x [PRIX UNITAIRE] (ex: "12 x 0.950d")
   -> Vous DEVEZ impérativement regrouper ces informations dans le MÊME objet article. 
   -> Dans cet exemple: quantity=12, unitPrice=0.950, lineTotal=11.400.

2. **Prix et Devises**: 
   - Le suffixe 'd' ou 'dt' indique souvent les Millimes/Dinars. Ignorez le 'd' pour ne garder que le nombre.
   - Les prix ont souvent 3 décimales (ex: 0.950, 11.400).

3. **Logique de calcul**:
   - Si vous voyez "Quantity x UnitPrice", vérifiez que Quantity * UnitPrice ≈ LineTotal.
   - Si le montant total est présent seul (ex: "LAIT CONCENTR 7.900"), considérez quantity=1 et unitPrice=7.900.

4. **Champs additionnels**:
   - barcode: capturez le code numérique situé juste sous le libellé.
   - rawLabel: le nom complet (ex: "25CL DELIO AROMA G").
   - category: déduire selon le type de produit.

5. **Cohérence globale**:
   - Extraire le nom du magasin (ex: "Carrefour"), la date et l'heure (chercher format JJ/MM/AA ou similaire), et le TOTAL final.
   - Le total final doit correspondre à la somme des "lineTotal" extraits.

Voici le reçu à analyser:
{{media url=receiptDataUri mimeType=mimeType}}
`,
});

const extractReceiptDataFlow = ai.defineFlow(
  {
    name: 'extractReceiptDataFlow',
    inputSchema: ExtractReceiptDataInputSchema,
    outputSchema: ExtractReceiptDataOutputSchema,
  },
  async (input: ExtractReceiptDataInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
