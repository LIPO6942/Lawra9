import { NextResponse } from 'next/server';
import { getAdminDb, admin } from '@/lib/firebase-admin';

// Force Next.js à ne pas pré-rendre cette route au build
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Vérification du secret CRON
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const adminDb = getAdminDb();
    // On s'assure que Firebase Admin est bien initialisé avant d'y accéder (lazy initialization gérée)

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Les 3 dates clés
    const date3DaysLater = new Date(today); date3DaysLater.setDate(today.getDate() + 3);
    const date7DaysAgo = new Date(today); date7DaysAgo.setDate(today.getDate() - 7);

    const targets = [
      { date: formatDate(date3DaysLater), label: 'J-3', message: (name: string, amount: string) => `⏰ Rappel : La facture "${name}"${amount ? ` (${amount} TND)` : ''} arrive à échéance dans 3 jours.` },
      { date: formatDate(today),          label: 'Jour-J', message: (name: string, amount: string) => `🔔 Aujourd'hui : La facture "${name}"${amount ? ` (${amount} TND)` : ''} est à payer aujourd'hui !` },
      { date: formatDate(date7DaysAgo),   label: 'J+7', message: (name: string, amount: string) => `🚨 En retard : La facture "${name}"${amount ? ` (${amount} TND)` : ''} n'a pas été payée depuis 7 jours.` },
    ];

    console.log('CRON FCM lancé. Cibles:', targets.map(t => `${t.label} (${t.date})`).join(', '));

    let totalSent = 0;
    const results: any[] = [];

    // Récupérer tous les documents "pending" via collectionGroup
    const pendingDocs = await adminDb.collectionGroup('documents')
      .where('status', '==', 'pending')
      .get();

    for (const docSnap of pendingDocs.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      if (!dueDate) continue;

      const target = targets.find(t => t.date === dueDate);
      if (!target) continue;

      // Récupérer l'userId depuis le chemin de la collection (users/{userId}/documents/{docId})
      const userId = docSnap.ref.parent.parent?.id;
      if (!userId) continue;

      // Récupérer l'abonnement push de cet utilisateur
      const pushDoc = await adminDb.doc(`users/${userId}/settings/push`).get();
      if (!pushDoc.exists) continue;

      const pushData = pushDoc.data();
      
      // Ici, au lieu d'une "subscription" en chaîne JS, on check le tableau de tokens
      if (!pushData?.enabled || !pushData?.tokens || pushData.tokens.length === 0) continue;

      const notifMessage = target.message(data.name || 'Document', data.amount || '');

      // On boucle sur tous les tokens enregistrés pour ce User
      for (const token of pushData.tokens) {
        try {
          // Utilisation du module Firebase Admin Messaging intégré
          await admin.messaging().send({
            token: token,
            notification: {
              title: '🧾 Lawra9 — Rappel Facture',
              body: notifMessage,
            },
            // Le "data" si tu as besoin de re-router sur le frontend
            data: {
              url: '/dashboard'
            }
          });
          
          totalSent++;
          results.push({ userId, doc: data.name, type: target.label, status: 'sent' });
        } catch (pushError: any) {
          console.error(`Erreur push (FCM) pour userId=${userId}:`, pushError);
          // Si le token est expiré (invalid-registration-token ou registration-token-not-registered)
          if (pushError.code === 'messaging/invalid-registration-token' ||
              pushError.code === 'messaging/registration-token-not-registered') {
             // Nettoyage: retirer le vieux token du store
             await adminDb.doc(`users/${userId}/settings/push`).update({
                 tokens: admin.firestore.FieldValue.arrayRemove(token)
             });
          }
          results.push({ userId, doc: data.name, type: target.label, status: 'error', code: pushError.code });
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalNotificationsSent: totalSent,
      details: results,
    });

  } catch (error: any) {
    console.error('Erreur Firebase Admin CRON:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
