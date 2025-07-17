
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("La variable d'environnement GOOGLE_API_KEY est manquante. Veuillez l'ajouter à votre fichier .env pour utiliser les fonctionnalités IA.");
}

export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_API_KEY
  })],
  model: 'googleai/gemini-2.0-flash',
});
