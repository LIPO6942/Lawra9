
import { config } from 'dotenv';
config();

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

let apiKey = process.env.GOOGLE_API_KEY;

if (apiKey) {
  // Nettoie la clé pour enlever les espaces et les guillemets potentiels
  apiKey = apiKey.trim().replace(/^"|"$/g, '');
}

if (!apiKey) {
  console.error("ERREUR CRITIQUE: La variable d'environnement GOOGLE_API_KEY est manquante dans votre fichier .env.");
  throw new Error("La variable d'environnement GOOGLE_API_KEY est manquante. Veuillez l'ajouter à votre fichier .env pour utiliser les fonctionnalités IA.");
} else {
  // Affiche un message pour confirmer que la clé est chargée, sans l'exposer entièrement.
  console.log(`Clé d'API Google chargée avec succès (commence par: ${apiKey.substring(0, 4)}...).`);
}

export const ai = genkit({
  plugins: [googleAI({
    apiKey: apiKey
  })],
  model: 'googleai/gemini-2.0-flash',
});
