'use server';

/**
 * @fileOverview A flow to extract invoice data from images or PDFs.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A data URI of the invoice image or PDF, that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  supplier: z.string().describe('The name of the supplier. Should be "STEG" for electricity, "SONEDE" for water, or the provider name like "Orange" for others.'),
  amount: z.string().describe('The total amount due on the invoice.'),
  dueDate: z.string().describe('The due date of the invoice in YYYY-MM-DD format.'),
  billingStartDate: z.string().optional().describe('The start date of the billing period in YYYY-MM-DD format.'),
  billingEndDate: z.string().optional().describe('The end date of the billing period in YYYY-MM-DD format.'),
  reference: z.string().describe('The invoice reference number.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `You are an expert at extracting data from Tunisian invoices.

  Please extract the following information from the invoice image provided:
  - Supplier Name: Be specific. For electricity, it must be "STEG". For water, it must be "SONEDE". For telecom, it can be "Orange", "Ooredoo", etc.
  - Amount: The total amount to pay.
  - Due Date: The payment deadline.
  - Billing Start Date: The start of the consumption period.
  - Billing End Date: The end of the consumption period.
  - Reference Number

  Return all dates in YYYY-MM-DD format.

  Here is the invoice:
  {{media url=invoiceDataUri}}
  `,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
