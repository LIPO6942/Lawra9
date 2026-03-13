/**
 * Route : GET /api/gmail/auth
 * Redirige l'utilisateur vers Google pour autoriser l'accès Gmail (OAuth 2.0)
 * Nécessite que l'utilisateur soit connecté (token Firebase dans le header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/gmail-client';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est connecté via Firebase
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Générer l'URL OAuth en passant l'userId comme state (pour le retrouver au callback)
    const state = Buffer.from(userId).toString('base64');
    const authUrl = getGoogleAuthUrl(state);

    // Retourner l'URL (le client redirige lui-même)
    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error('[Gmail Auth] Erreur:', error.message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
