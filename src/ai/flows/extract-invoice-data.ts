
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A data URI of the invoice or receipt image/PDF, that must include a MIME type and use Base64 encoding."
    ),
  mimeType: z.string().optional(),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  documentType: z.string().describe('Type de document (STEG, SONEDE, Maison, Internet, Assurance, Contrat, Autre).'),
  supplier: z.string().describe('Fournisseur (ex: STEG, SONEDE, Orange).'),
  amount: z.string().describe('Montant total.'),
  dueDate: z.string().optional().describe('Date d\'échéance AAAA-MM-JJ.'),
  issueDate: z.string().optional().describe('Date d\'émission AAAA-MM-JJ.'),
  invoiceNumber: z.string().optional(),
  billingStartDate: z.string().optional(),
  billingEndDate: z.string().optional(),
  consumptionPeriod: z.string().optional(),
  consumptionQuantity: z.string().optional(),
  gasAmount: z.string().optional(),
  gasConsumptionQuantity: z.string().optional(),
  reference: z.string().optional(),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

const INVOICE_PROMPT = `Vous êtes un expert en factures tunisiennes (STEG, SONEDE, Orange, Ooredoo, Topnet, etc.).
Votre mission est d'extraire les données avec une précision chirurgicale.

**DÉTERMINATION DU FOURNISSEUR (CRITIQUE) :**
1. **SONEDE (EAU)** : 
   - RECHERCHEZ : "SONEDE", "الشركة الوطنية لاستغلال وتوزيع المياه", "District", "Eau potable".
   - PÉRIODE : Repérez "فترة الاستهلاك" (souvent en haut/milieu). Juste après, il y a un code à 4 segments type "2025-08-07-06".
   - ÉCHÉANCE (CRITIQUE) : Repérez le bloc de texte "الرجاء الدفع", "تاريخ الاستخلاص", "Prière de payer" ou "Avant le" (en bas à gauche). La date d'échéance se trouve TOUJOURS immédiatement à GAUCHE de ce texte ou juste au-dessus. Cherchez une date isolée dans le coin inférieur GAUCHE. **IMPORTANT : Cette date peut être dans le passé (2024, 2025, etc.), extrayez-la telle quelle.**
    - CONSOMMATION (EAU) : Cherchez "كمية الإستهلاك", "الكمية", "Quantité consommée", "Le volume consommé", "Volume" ou "Consommation" en m3. Elle se trouve TOUJOURS dans une case dédiée sous "كمية الإستهلاك". Si vous voyez deux index (ancien/nouveau), la consommation est la différence (ex: 384-371=13). Priorisez le petit nombre (ex: 13).
2. **STEG (ÉLEC/GAZ)** : 
   - RECHERCHEZ : "STEG", "الشركة التونسية للكهرباء والغاز".
   - PÉRIODE : Repérez "Du" (من) et "Au" (إلى) en haut à droite.
   - ÉCHÉANCE (CRITIQUE) : Cherchez "Prière de payer avant le" ou "الرجاء الدفع قبل" (en bas à droite). **C'est la SEULE date d'échéance.**
   - IGNOREZ : Ne confondez JAMAIS avec "التاريخ المقبل لقراءة العداد" ou "Prochain relevé d'index" (souvent en bas à droite aussi). C'est une date futuriste de relevé, PAS l'échéance.
   - STRUCTURE TABLEAU "CONSOMMATION & SERVICES" :
     - Colonne 1 (à gauche) : TVA (%)
     - Colonne 2 : Montant Hors taxes (4) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 3 : Prix unitaire (3) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 4 : Moyenne mensuelle (2) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 5 : **Quantité (1) -> C'EST ICI QU'EST LA CONSOMMATION (EX: 501, 19)**
   - CONSOMMATION (ÉLEC) : Cherchez la ligne qui commence par "Électricité" (كهرباء). Prenez la valeur dans la Colonne 5 (ex: "501"). **NE PRENEZ PAS "99.376"** (qui est le montant total élec).
   - CONSOMMATION (GAZ) : Cherchez la ligne qui commence par "Gaz" (غاز). Prenez la valeur dans la Colonne 5 (ex: "19"). **NE PRENEZ PAS "7.389"** (qui est le montant total gaz).

**RÈGLES D'OR (CRITIQUE) :**
- **ANTI-TOTAL** : Ne confondez JAMAIS une quantité (ex: 501 kWh) avec un montant monétaire (ex: 99.376 TND). Les quantités (colonne 5) sont souvent des entiers simples. Les montants (colonne 2) ont souvent 3 décimales (ex: 4,389).
- **LIGNES TOTALES** : Ignorez les lignes "TOTAL ÉLECTRICITÉ", "TOTAL GAZ", "TOTAL SERVICES" pour l'extraction des quantités. Les quantités sont sur les lignes de base ("Électricité", "Gaz").
- **NON-DUPLICATION** : Ne répétez JAMAIS un chiffre s'il apparaît plusieurs fois (ex: si "13" est écrit deux fois, extrayez "13", pas "133" ou "26").
- **DATES PASSÉES** : Acceptez et extrayez TOUTES les dates, même si elles sont en 2024, 2025 ou avant. Ne les ignorez jamais parce qu'elles sont passées.
- **CONSOMMATION OBLIGATOIRE** : Pour SONEDE (m3) et STEG (kWh), vous DEVEZ trouver une quantité. Cherchez la case "Consommation" ou "الكمية". Si plusieurs paliers, prenez le TOTAL des quantités uniquement.
- **UNITÉS** : Extrayez le nombre pur ou avec l'unitée (ex: "501", "19", "145 kWh", "22 m3").
- **RÉALISME** : Une consommation d'eau domestique est souvent un petit nombre (ex: 13). Ne confondez pas avec l'index du compteur (ex: 384) ou le montant total.

**RÈGLES D'EXTRACTION DES DONNÉES :**
- **documentType** : "SONEDE", "STEG", "Internet", "Recus de caisse" ou "Autre".
- **amount** : Montant Total (ex: "72.000").
- **dueDate** : Date limite (AAAA-MM-JJ). **EXTRAYEZ MÊME SI LA DATE EST PASSÉE.** Pour SONEDE, elle est TOUJOURS en bas à gauche.
- **consumptionQuantity** : ÉLECTRICITÉ (kWh) pour STEG (Colonne 5), ou VOLUME D'EAU (m3) pour SONEDE. Prenez la valeur UNIQUE (ex: "501") même si répétée sur la facture.
- **gasConsumptionQuantity** : VOLUME DE GAZ (m3) pour STEG (Colonne 5, ex: "19").
- **billingStartDate** / **billingEndDate** : Dates de la période STEG (من / à / Du / Au).
- **consumptionPeriod** : Pour SONEDE, Format "AAAA-MM-MM-MM".

IMPORTANT : Retournez UNIQUEMENT du JSON pur. N'inventez rien. SI UNE DONNÉE N'EST PAS CLAIRE, CHERCHEZ MIEUX, MAIS NE LAISSEZ VIDE QUE SI VRAIMENT ABSENTE.`;

async function extractWithGroq(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput | null> {
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
          { role: 'system', content: 'Tu es un expert en extraction JSON de factures tunisiennes (STEG/SONEDE). Restreint la sortie au JSON pur.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: INVOICE_PROMPT },
              { type: 'image_url', image_url: { url: input.invoiceDataUri } },
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
    return content ? JSON.parse(content) : null;
  } catch (e) {
    console.error('[Groq Invoice] Error:', e);
    return null;
  }
}

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  // 1. Try Groq (Preferred)
  const groqRes = await extractWithGroq(input);
  if (groqRes) return groqRes;

  // 2. Fallback to Gemini
  try {
    const result = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: INVOICE_PROMPT },
        { media: { url: input.invoiceDataUri, contentType: input.mimeType || 'image/jpeg' } },
      ],
      output: { schema: ExtractInvoiceDataOutputSchema },
    });
    if (result.output) return result.output;
    throw new Error("No output from Gemini");
  } catch (err: any) {
    throw new Error(`Analyse IA impossible: ${err.message}`);
  }
}