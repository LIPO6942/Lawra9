'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReceiptLineSchema = z.object({
  id: z.string().describe('ID unique de la ligne'),
  rawLabel: z.string().describe('Libellé tel que sur le reçu'),
  normalizedLabel: z.string().optional().describe('Libellé normalisé'),
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
  prompt: `Vous êtes un assistant d'extraction de tickets de caisse en français (et arabe si présent).

Objectif: retourner les métadonnées du reçu et TOUTES les lignes d'articles structurées.

Règles:
- Détecter: nom magasin, date/heure d'achat, devise, total, sous-total, total TVA.
- Extraire chaque ligne: libellé exact (rawLabel), quantité, unité, prix unitaire, total ligne.
- Si la quantité n'est pas indiquée, considérer 1.
- Normaliser les nombres (virgule -> point). Retourner les valeurs numériques.
- Si un code-barres/PLU apparait, le retourner dans barcode.
- Vérifier la cohérence: somme des lignes ≈ total (tolérance 2%).
- Mettre confidence entre 0 et 1 selon votre certitude globale.
- Inclure dans ocrText un résumé texte si utile.

Retourner les dates au format ISO AAAA-MM-JJ ou AAAA-MM-JJTHH:mm si heure trouvée.

Voici le reçu:
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
