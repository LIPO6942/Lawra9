
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Next.js automatically loads environment variables from .env.local
// No other configuration is needed.
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("ERREUR CRITIQUE: La variable d'environnement GOOGLE_API_KEY est manquante dans votre fichier .env.local.");
  // We don't throw an error to avoid breaking the build, but Genkit will not work.
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
