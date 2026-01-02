
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
    - CONSOMMATION (EAU) : Cherchez "كمية الإستهلاك", "الكمية", "Quantité consommée", "Le volume consommé", "Volume" ou "Consommation" en m3. Elle se trouve TOUJOURS dans une case dédiée sous "كمية الإستهلاك". Si vous voyez deux index (ancien/nouveau), la consommation est la différence (ex: 384-371=13). Priorisez le petit nombre (ex: 13). Extrayez UNIQUEMENT le nombre (ex: "13"). L'unité est toujours m3 pour l'eau.
2. **STEG (ÉLEC/GAZ)** : 
   - RECHERCHEZ : "STEG", "الشركة التونسية للكهرباء والغاز".
   - PÉRIODE : Repérez "Du" (من) et "Au" (إلى) en haut à droite. Ces dates correspondent à billingStartDate et billingEndDate.
   - ÉCHÉANCE (CRITIQUE/CHIRURGICAL) : En bas à droite de la facture, il y a DEUX cadres avec des dates. 
     - **Date de GAUCHE** : Dans le cadre "Prière de payer avant le" (الرجاء الدفع قبل). **C'EST CELLE-LÀ QUE VOUS DEVEZ EXTRAIRE.** (Ex: 11/12/2025).
     - **Date de DROITE** : Dans le cadre "Prochain relevé d'index" (التاريخ المقبل لقراءة العداد). **IGNOREZ-LA ABSOLUMENT.** (Ex: 17/03/2026).
   - STRUCTURE TABLEAU "CONSOMMATION & SERVICES" :
     - Colonne 1 (à gauche) : TVA (%)
     - Colonne 2 : Montant Hors taxes (4) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 3 : Prix unitaire (3) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 4 : Moyenne mensuelle (2) -> **IGNOREZ POUR LA CONSOMMATION**
     - Colonne 5 : **Quantité (1) -> C'EST ICI QU'EST LA CONSOMMATION (EX: 501, 19)**
   - CONSOMMATION (ÉLEC) : Cherchez la ligne qui commence par "Électricité" (كهرباء). Prenez la valeur dans la Colonne 5 (ex: "501"). **NE PRENEZ PAS "99.376"** (colonne 2).
   - CONSOMMATION (GAZ) : Cherchez la ligne qui commence par "Gaz" (غاز). Prenez la valeur dans la Colonne 5 (ex: "19"). **NE PRENEZ PAS "7.389"** (colonne 2).

**RÈGLES D'OR (CRITIQUE) :**
- **ANTI-TOTAL** : Ne confondez JAMAIS une quantité (ex: 501 kWh) avec un montant monétaire (ex: 99.376 TND). Les quantités (colonne 5) sont souvent des entiers simples. Les montants (colonne 2) ont souvent 3 décimales.
- **DATES STEG** : Dans le bloc "Echéance/Prochain relevé" en bas, priorisez TOUJOURS le bloc le plus à gauche ou celui titré "Prière de payer".
- **NON-DUPLICATION** : Ne répétez JAMAIS un chiffre s'il apparaît plusieurs fois (ex: si "13" est écrit deux fois, extrayez "13", pas "133" ou "26").
- **DATES PASSÉES** : Acceptez et extrayez TOUTES les dates, même si elles sont en 2024, 2025 ou avant.
- **CONSOMMATION OBLIGATOIRE** : Pour SONEDE (m3) et STEG (kWh), vous DEVEZ trouver une quantité. Cherchez la case "الكمية". Si plusieurs paliers, prenez le TOTAL des quantités uniquement. Pour l'électricité, utilisez le champ 'consumptionQuantity'.
- **UNITÉS** : Extrayez le nombre pur sans l'unité (ex: "501", "13"). Le système se chargera de l'unité selon le type.
- **RÉALISME** : Une consommation d'eau domestique est souvent un petit nombre (ex: 13). Ne confondez pas avec l'index ou le montant. Une consommation d'électricité est souvent un nombre à 2 ou 3 chiffres (ex: 501).

**RÈGLES D'EXTRACTION DES DONNÉES :**
- **documentType** : "SONEDE", "STEG", "Internet", "Recus de caisse" ou "Autre".
- **amount** : Montant Total (ex: "72.000").
- **dueDate** : Date limite (FORMAT STRICT : AAAA-MM-JJ). **EXTRAYEZ MÊME SI LA DATE EST PASSÉE.** 
   - Pour SONEDE : Elle est en bas à gauche.
   - Pour STEG : C'est la date dans le cadre de **GAUCHE** ("Prière de payer") en bas à droite. Ignorez la date de DROITE.
   - Si la date est "11/12/2025", retournez "2025-12-11".
- **consumptionQuantity** : ÉLECTRICITÉ (kWh) pour STEG (Colonne 5, ex: "501"), ou VOLUME D'EAU (m3) pour SONEDE.
- **gasConsumptionQuantity** : VOLUME DE GAZ (m3) pour STEG (Colonne 5, ex: "19").
- **billingStartDate** / **billingEndDate** : Dates de la période STEG (FORMAT STRICT : AAAA-MM-JJ).
- **consumptionPeriod** : Pour SONEDE, Format "AAAA-MM-MM-MM". 
- **supplier** : Nom du fournisseur (ex: "STEG", "SONEDE", "Ooredoo", "Monoprix").
- **invoiceNumber** : Numéro de facture.

**EXEMPLE DE RÉPONSE JSON :**
{
  "documentType": "STEG",
  "amount": "72.345",
  "dueDate": "2025-12-11",
  "consumptionQuantity": "501",
  "gasConsumptionQuantity": "19",
  "billingStartDate": "2025-07-15",
  "billingEndDate": "2025-11-14",
  "supplier": "STEG"
}
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