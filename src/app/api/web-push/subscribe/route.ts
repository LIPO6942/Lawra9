import { NextResponse } from 'next/server';
import { getAdminDb, admin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId, token } = await request.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'userId et token sont requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const pushDocRef = adminDb.doc(`users/${userId}/settings/push`);

    // Utilisation propre de arrayUnion pour ajouter le token sans doublon
    await pushDocRef.set({
      tokens: admin.firestore.FieldValue.arrayUnion(token),
      updatedAt: new Date().toISOString(),
      enabled: true,
    }, { merge: true });

    return NextResponse.json({ success: true, message: 'Token FCM enregistré.' });
  } catch (error: any) {
    console.error('Erreur POST /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId est requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    await adminDb.doc(`users/${userId}/settings/push`).set({
      enabled: false,
      tokens: [],
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true, message: 'Abonnement push supprimé.' });
  } catch (error: any) {
    console.error('Erreur DELETE /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
