
'use server';

/**
 * @fileOverview A flow to compare two invoices and highlight their differences.
 *
 * - compareInvoices - A function that handles the comparison process.
 * - CompareInvoicesInput - The input type for the compareInvoices function.
 * - CompareInvoicesOutput - The return type for the compareInvoices function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CompareInvoicesInputSchema = z.object({
  invoice1DataUri: z
    .string()
    .describe(
      "The first invoice document as a data URI, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Doit être la plus ancienne des deux."
    ),
  invoice2DataUri: z
    .string()
    .describe(
      "The second invoice document as a data URI, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Doit être la plus récente des deux."
    ),
    invoice1Name: z.string().describe("Le nom ou identifiant pour la première facture (la plus ancienne)."),
    invoice2Name: z.string().describe("Le nom ou identifiant pour la seconde facture (la plus récente)."),
});
export type CompareInvoicesInput = z.infer<typeof CompareInvoicesInputSchema>;

const CompareInvoicesOutputSchema = z.object({
  costDifference: z.string().optional().describe("La différence de coût total entre les deux factures (Facture 2 - Facture 1), en TND. Précisez le signe. Ex: '+15,300 TND' ou '-5,120 TND'"),
  costPercentageChange: z.string().optional().describe("La variation du coût en pourcentage. Précisez le signe. Ex: '+25,5%' ou '-10,2%'"),
  consumptionDifferences: z.array(z.object({
      type: z.string().describe("Le type de consommation (ex: 'Électricité', 'Gaz', 'Eau')."),
      difference: z.string().describe("La différence de consommation avec unité et signe. Ex: '+40 kWh', '-10 m³'"),
  })).optional().describe("Une liste des différences de consommation pour chaque ressource."),
  period1: z.string().optional().describe("La période ou la date de la première facture."),
  period2: z.string().optional().describe("La période ou la date de la deuxième facture."),
  summary: z.string().describe("Un résumé global et concis (1 phrase) de la comparaison. Ex: 'Facture en hausse de 15 TND, principalement due à une augmentation de la consommation d'électricité.'"),
  insights: z.array(z.string()).optional().describe("Une liste de 2-3 points clés ou observations intéressantes. Chaque point doit être une chaîne de caractères courte. Ex: ['La consommation de gaz a doublé.', 'Le coût unitaire de l'électricité semble stable.']"),
  recommendations: z.array(z.string()).optional().describe("Une liste de 1-2 recommandations concrètes et simples si une hausse est détectée. Chaque recommandation est une chaîne. Ex: ['Pensez à éteindre les lumières en quittant une pièce.', 'Vérifiez l'isolation de vos fenêtres.']"),
});
export type CompareInvoicesOutput = z.infer<typeof CompareInvoicesOutputSchema>;

export async function compareInvoices(input: CompareInvoicesInput): Promise<CompareInvoicesOutput> {
  return compareInvoicesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'compareInvoicesPrompt',
  input: {schema: CompareInvoicesInputSchema},
  output: {schema: CompareInvoicesOutputSchema},
  prompt: `Vous êtes un analyste financier expert, spécialisé dans l'optimisation des factures domestiques. Votre mission est de comparer deux factures pour un particulier et de lui fournir une analyse claire, poussée mais très concise.

  Facture 1 (la plus ancienne) : {{{invoice1Name}}}
  {{media url=invoice1DataUri}}
  
  Facture 2 (la plus récente) : {{{invoice2Name}}}
  {{media url=invoice2DataUri}}

  **Instructions d'analyse :**

  1.  **Extraire les Périodes** : Identifiez les périodes de facturation pour chaque facture.
  2.  **Comparer les Coûts** :
      *   Calculez la différence de coût total (Facture 2 - Facture 1) et le pourcentage de variation.
  3.  **Comparer les Consommations** :
      *   Pour chaque ressource (Électricité, Gaz, Eau...), calculez la différence de consommation chiffrée (ex: '+40 kWh').
  4.  **Générer un Résumé Concis** :
      *   Rédigez une seule phrase percutante qui résume la situation (ex: "Facture en hausse de 25%, principalement due à une augmentation de la consommation de gaz.").
  5.  **Fournir des "Insights"** :
      *   Identifiez 2 ou 3 observations clés et factuelles qui expliquent les variations. Soyez direct.
      *   Exemples : "Le prix unitaire de l'eau a légèrement augmenté.", "La consommation électrique a baissé malgré un coût total en hausse."
  6.  **Suggérer des Recommandations (si hausse)** :
      *   Si le coût total a augmenté, proposez 1 ou 2 actions simples et concrètes que l'utilisateur peut entreprendre.
      *   Exemples : "Pensez à vérifier l'étanchéité de vos robinets.", "Utilisez des ampoules LED basse consommation."
      *   Si le coût a baissé ou est stable, ne donnez pas de recommandation.

  **Ton & Style** : Soyez direct, factuel et utilisez un langage simple. L'objectif est d'aider l'utilisateur à comprendre ses factures et à agir, pas de le noyer sous les chiffres.

  Analysez les documents et remplissez **tous** les champs du schéma de sortie.`,
});

const compareInvoicesFlow = ai.defineFlow(
  {
    name: 'compareInvoicesFlow',
    inputSchema: CompareInvoicesInputSchema,
    outputSchema: CompareInvoicesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
