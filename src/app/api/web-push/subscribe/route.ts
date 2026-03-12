import { NextResponse } from 'next/server';
import { getAdminDb, admin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('--- DEBUT SUBSCRIBE POST ---');
    const body = await request.json();
    const { userId, token } = body;
    console.log('Données reçues:', { userId, tokenLength: token?.length });

    if (!userId || !token) {
      console.error('Erreur: userId ou token manquant');
      return NextResponse.json({ error: 'userId et token sont requis.' }, { status: 400 });
    }

    console.log('Initialisation de Admin DB...');
    const adminDb = getAdminDb();
    
    console.log(`Accès au document: users/${userId}/settings/push`);
    const pushDocRef = adminDb.doc(`users/${userId}/settings/push`);

    console.log('Tentative de sauvegarde dans Firestore...');
    // Utilisation propre de arrayUnion pour ajouter le token sans doublon
    await pushDocRef.set({
      tokens: admin.firestore.FieldValue.arrayUnion(token),
      updatedAt: new Date().toISOString(),
      enabled: true,
    }, { merge: true });

    console.log('Sauvegarde REUSSIE');
    return NextResponse.json({ success: true, message: 'Token FCM enregistré.' });
  } catch (error: any) {
    console.error('ERREUR DETECTEE DANS SUBSCRIBE API:', error);
    return NextResponse.json({ 
      error: error.message, 
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
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
