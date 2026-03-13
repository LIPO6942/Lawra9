/**
 * Route : GET /api/gmail/callback
 * Reçoit le code OAuth de Google, échange contre les tokens, stocke dans Firestore
 * Redirige vers /settings après succès ou erreur
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/gmail-client';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawra9.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // L'utilisateur a refusé l'accès
  if (error) {
    console.warn('[Gmail Callback] Accès refusé par l\'utilisateur:', error);
    return NextResponse.redirect(`${APP_URL}/settings?gmail=denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail=error&reason=missing_params`);
  }

  try {
    // Décoder l'userId depuis le state
    const userId = Buffer.from(state, 'base64').toString('utf-8');
    if (!userId) {
      throw new Error('State invalide — userId introuvable');
    }

    // Échanger le code contre les tokens Google
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // Peut arriver si l'utilisateur avait déjà autorisé sans révocation
      // Dans ce cas, inviter à révoquer et recommencer
      return NextResponse.redirect(`${APP_URL}/settings?gmail=error&reason=no_refresh_token`);
    }

    // Calculer l'expiration du token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Stocker les tokens dans Firestore
    const db = getAdminDb();
    await db
      .collection('users')
      .doc(userId)
      .collection('integrations')
      .doc('gmail')
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        connectedAt: FieldValue.serverTimestamp(),
        lastSyncAt: null,
        status: 'active',
      });

    console.log(`[Gmail Callback] Tokens stockés pour userId: ${userId}`);

    // Rediriger vers settings avec succès
    return NextResponse.redirect(`${APP_URL}/settings?gmail=success`);
  } catch (error: any) {
    console.error('[Gmail Callback] Erreur:', error.message);
    return NextResponse.redirect(`${APP_URL}/settings?gmail=error&reason=server`);
  }
}
