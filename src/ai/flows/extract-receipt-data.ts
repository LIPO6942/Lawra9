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
  console.log("[Genkit] Début extractReceiptData (taille image:", input.receiptDataUri.length, ")");

  try {
    // Timeout de sécurité 50s
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout IA (50s)")), 50000)
    );

    const result = await Promise.race([
      prompt(input),
      timeout
    ]) as any;

    if (!result || !result.output) {
      throw new Error("L'IA n'a pas retourné de résultat valide.");
    }

    console.log("[Genkit] Analyse réussie.");
    // Force la sérialisation pour éviter les erreurs de "Server Components render"
    return JSON.parse(JSON.stringify(result.output));
  } catch (error: any) {
    console.error("[Genkit] Erreur fatale lors de l'analyse:", error.message || error);
    return {
      storeName: "Échec de l'analyse",
      lines: [],
      ocrText: `Erreur: ${error.message || "Problème de communication avec l'IA"}`
    } as any;
  }
}
const prompt = ai.definePrompt({
  name: 'extractReceiptDataPrompt',
  input: { schema: ExtractReceiptDataInputSchema },
  output: { schema: ExtractReceiptDataOutputSchema },
  prompt: `Vous êtes un expert en extraction de données de tickets de caisse, spécialisé dans les formats de supermarchés (ex: Carrefour Tunisie).

Objectif: Extraire toutes les métadonnées et TOUTES les lignes d'articles de façon structurée.

Règles de lecture CRITIQUES pour les articles:
1. **Structure multi-lignes (Patron Carrefour)**: Un article est généralement structuré sur 3 lignes :
   - Ligne 1: [PRÉFIXE ÉVENTUEL] [LIBELLÉ DE L'ARTICLE] [MONTANT TOTAL LIGNE]
     *Note: Le préfixe (ex: 'R', '*', '>>') doit être ignoré dans normalizedLabel mais peut rester dans rawLabel.*
     *Exemple: "R 25CL DELIO AROMA G 11.400d" -> Label: "25CL DELIO AROMA G", Total: 11.400*
   - Ligne 2: [CODE-BARRES] (ex: "6191534802476")
   - Ligne 3: [QUANTITÉ] x [PRIX UNITAIRE] (ex: "12 x 0.950d")
   -> Regroupez ces 3 lignes en UN SEUL objet article.

2. **Extraction des Valeurs**:
   - Supprimez le suffixe 'd' (Dinar) pour ne garder que le nombre décimal.
   - Si "Quantity x UnitPrice" est présent sur la ligne suivante, utilisez-les.
   - Si seule la Ligne 1 est présente, alors Quantity=1 et UnitPrice=Montant Total.

3. **Validation**:
   - Calculez toujours Quantity * UnitPrice. Si le résultat ≈ Montant Total de la Ligne 1, l'extraction est correcte.
   - En cas de promotion (ligne négative juste en dessous), essayez de l'associer à l'article ou listez-la comme un article à prix négatif.

4. **Métadonnées**:
   - Trouvez le nom du magasin (Carrefour), la date (format JJ/MM/AA), l'heure, et le TOTAL final du ticket.

Voici le reçu à analyser:
{{media url=receiptDataUri mimeType=mimeType}}
`,
});

// Facultatif: un flow pour Genkit UI
export const extractReceiptDataFlow = ai.defineFlow(
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
