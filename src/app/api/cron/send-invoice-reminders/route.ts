import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import webpush from 'web-push';

// Configure web-push avec tes clés VAPID
webpush.setVapidDetails(
  'mailto:admin@lawra9.app', // Remplace par ton email
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // 1. Vérification du secret CRON
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
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

    console.log('CRON lancé. Cibles:', targets.map(t => `${t.label} (${t.date})`).join(', '));

    let totalSent = 0;
    const results: any[] = [];

    // 2. Récupérer tous les documents "pending" avec les dates cibles
    const pendingDocs = await adminDb.collectionGroup('documents')
      .where('status', '==', 'pending')
      .get();

    for (const docSnap of pendingDocs.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      if (!dueDate) continue;

      const target = targets.find(t => t.date === dueDate);
      if (!target) continue;

      // Récupérer l'userId depuis le chemin du document (users/{userId}/documents/{docId})
      const userId = docSnap.ref.parent.parent?.id;
      if (!userId) continue;

      // 3. Récupérer l'abonnement push de cet utilisateur
      const pushDoc = await adminDb.doc(`users/${userId}/settings/push`).get();
      if (!pushDoc.exists) continue;

      const pushData = pushDoc.data();
      if (!pushData?.enabled || !pushData?.subscription) continue;

      let pushSubscription;
      try {
        pushSubscription = JSON.parse(pushData.subscription);
      } catch {
        console.error(`Impossible de parser l\'abonnement pour userId=${userId}`);
        continue;
      }

      const notifMessage = target.message(data.name || 'Document', data.amount || '');

      // 4. Envoyer la notification push !
      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: '🧾 Lawra9 — Rappel Facture',
            body: notifMessage,
          })
        );
        totalSent++;
        results.push({ userId, doc: data.name, type: target.label, status: 'sent' });
      } catch (pushError: any) {
        console.error(`Erreur push pour userId=${userId}:`, pushError.statusCode, pushError.body);
        // Si l'abonnement est expiré (410), on le supprime de Firestore
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await adminDb.doc(`users/${userId}/settings/push`).set({ enabled: false, subscription: null }, { merge: true });
        }
        results.push({ userId, doc: data.name, type: target.label, status: 'error', error: pushError.body });
      }
    }

    return NextResponse.json({
      success: true,
      totalNotificationsSent: totalSent,
      details: results,
    });

  } catch (error: any) {
    console.error('Erreur CRON:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
