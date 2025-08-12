
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
  period1: z.string().optional().describe("La période ou la date de la première facture."),
  period2: z.string().optional().describe("La période ou la date de la deuxième facture."),
  summary: z.string().describe("Un résumé global et très concis (1-2 phrases) de la comparaison. Ce résumé doit prendre en compte le contexte (saisonnalité, durée de facturation). Ex: 'Hausse de 15 TND en été, probablement due à la climatisation, sur une période similaire.' ou 'Baisse notable de 20 TND, mais sur une période de facturation plus courte.'"),
  insights: z.array(z.string()).optional().describe("Une liste de 2-3 points d'analyse ou pistes de réflexion créatives pour expliquer la variation. Chaque point doit être une chaîne de caractères courte. Ex: ['Avez-vous installé un nouvel appareil énergivore récemment ?', 'La différence de saison (hiver/été) peut expliquer l'usage accru du chauffage/climatisation.', 'Une légère augmentation du prix au kWh a été constatée.']"),
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
  prompt: `Vous êtes un analyste financier expert, spécialisé dans l'optimisation des factures domestiques. Votre mission est de comparer deux factures pour un particulier et de lui fournir une analyse Poussée, CONCISE et INTELLIGENTE.

  Facture 1 (la plus ancienne) : {{{invoice1Name}}}
  {{media url=invoice1DataUri}}
  
  Facture 2 (la plus récente) : {{{invoice2Name}}}
  {{media url=invoice2DataUri}}

  **Instructions d'analyse :**

  1.  **Extraire les Périodes & Coûts** : Identifiez les périodes de facturation et les coûts totaux pour chaque facture. Calculez la différence de coût absolue et en pourcentage.
  2.  **Analyser le Contexte (le plus important !)** :
      *   **Saisonnalité** : Les factures sont-elles dans des saisons différentes (été/hiver) ? Si oui, mentionnez que cela peut influencer fortement la consommation (chauffage, climatisation).
      *   **Durée de facturation** : Les périodes de facturation ont-elles la même durée ? Une différence de durée peut expliquer une différence de coût.
  3.  **Générer une Synthèse Intelligente** :
      *   Rédigez 1 ou 2 phrases qui résument la situation EN INTÉGRANT LE CONTEXTE. Ne vous contentez pas de donner des chiffres.
      *   Exemple : "Votre facture a augmenté de 15 TND, ce qui est probablement dû à l'utilisation de la climatisation en été, la période de facturation étant similaire."
  4.  **Fournir des "Insights" (Pistes de réflexion)** :
      *   Soyez créatif. Proposez 2-3 pistes qui pourraient expliquer les variations (en plus de la saison).
      *   Exemples : "Avez-vous installé de nouveaux appareils électriques récemment ?", "Un changement dans vos habitudes (télétravail, vacances) pourrait-il être un facteur ?", "Il serait peut-être utile de vérifier s'il y a de petites fuites d'eau."
  5.  **Suggérer des Recommandations (si hausse)** :
      *   Si le coût total a augmenté de manière significative (plus de 10%), proposez 1 ou 2 actions simples et concrètes.
      *   Si le coût a baissé, est stable, ou si la hausse s'explique logiquement (saison, etc.), ne donnez pas de recommandation.

  **Ton & Style** : Soyez direct, factuel et utilisez un langage simple. L'objectif est d'aider l'utilisateur à comprendre ses factures et à agir. L'analyse contextuelle est plus importante que la simple énumération de chiffres.

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
