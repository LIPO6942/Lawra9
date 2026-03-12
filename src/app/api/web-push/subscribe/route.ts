import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Force Next.js à ne pas pré-rendre cette route au build
export const dynamic = 'force-dynamic';

// POST : Enregistre l'abonnement push d'un utilisateur dans Firestore
export async function POST(request: Request) {
  try {
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return NextResponse.json({ error: 'userId et subscription sont requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    await adminDb.doc(`users/${userId}/settings/push`).set(
      {
        subscription: JSON.stringify(subscription),
        updatedAt: new Date().toISOString(),
        enabled: true,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, message: 'Abonnement push enregistré.' });
  } catch (error: any) {
    console.error('Erreur POST /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE : Supprime l'abonnement push d'un utilisateur (désabonnement)
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId est requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    await adminDb.doc(`users/${userId}/settings/push`).set(
      { enabled: false, subscription: null, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ success: true, message: 'Abonnement push supprimé.' });
  } catch (error: any) {
    console.error('Erreur DELETE /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
