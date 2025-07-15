import { config } from 'dotenv';
config();

import '@/ai/flows/extract-invoice-data.ts';
import '@/ai/flows/detect-document-type.ts';
import '@/ai/flows/generate-alerts-from-dates.ts';
import '@/ai/flows/fuzzy-search-documents.ts';