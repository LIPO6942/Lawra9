
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// IMPORTANT: Assurez-vous que votre clé API Google est définie comme variable d'environnement
// dans votre environnement de déploiement. Pour le développement local,
// Next.js charge automatiquement les variables depuis .env.local
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("ERREUR CRITIQUE: La variable d'environnement GOOGLE_API_KEY est manquante. Genkit ne fonctionnera pas.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
