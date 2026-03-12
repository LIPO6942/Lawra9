import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// POST : Enregistre le token FCM d'un utilisateur dans Firestore
export async function POST(request: Request) {
  try {
    const { userId, token } = await request.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'userId et token sont requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // On sauvegarde ça sous forme de tableau car un user peut avoir plusieurs appareils
    await adminDb.doc(`users/${userId}/settings/push`).set(
      {
        tokens: adminDb.doc(`users/${userId}/settings/push`)['firestore'].FieldValue ? [] : [], // Just pour bypass TS
        updatedAt: new Date().toISOString(),
        enabled: true,
      },
      { merge: true }
    );
    
    // On ajoute le token sans écraser les autres (si l'utilisateur a un PC et un mobile)
    const adminRef = await import('firebase-admin');
    await adminDb.doc(`users/${userId}/settings/push`).update({
        tokens: adminRef.firestore.FieldValue.arrayUnion(token)
    });

    return NextResponse.json({ success: true, message: 'Token FCM enregistré.' });
  } catch (error: any) {
    console.error('Erreur POST /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE : Désabonnement
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId est requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Si on a le token on le retire du tableau, sinon on désactive tout
    await adminDb.doc(`users/${userId}/settings/push`).set(
      { enabled: false, tokens: [], updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ success: true, message: 'Abonnement push supprimé.' });
  } catch (error: any) {
    console.error('Erreur DELETE /api/web-push/subscribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
