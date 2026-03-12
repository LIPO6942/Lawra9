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

    console.log('CRON FCM (Iterative) lancé. Cibles:', targets.map(t => `${t.label} (${t.date})`).join(', '));

    let totalSent = 0;
    const results: any[] = [];

    // 1. On récupère la liste de tous les utilisateurs (chemin sécurisé sans collectionGroup)
    const usersSnap = await adminDb.collection('users').get();
    
    for (const userSnap of usersSnap.docs) {
      const userId = userSnap.id;
      
      // 2. On vérifie si l'utilisateur a activé les notifications push
      const pushDoc = await adminDb.doc(`users/${userId}/settings/push`).get();
      if (!pushDoc.exists) continue;
      
      const pushData = pushDoc.data();
      if (!pushData?.enabled || !pushData?.tokens || pushData.tokens.length === 0) continue;

      // 3. On récupère les factures en attente pour CET utilisateur uniquement
      const pendingDocs = await adminDb.collection(`users/${userId}/documents`)
        .where('status', '==', 'pending')
        .get();

      for (const docSnap of pendingDocs.docs) {
        const data = docSnap.data();
        const dueDate = data.dueDate as string;
        if (!dueDate) continue;

        const target = targets.find(t => t.date === dueDate);
        if (!target) continue;

        const notifMessage = target.message(data.name || 'Document', data.amount || '');

        // 4. Envoi aux tokens de l'utilisateur
        for (const token of pushData.tokens) {
          try {
            await admin.messaging().send({
              token: token,
              notification: {
                title: '🧾 Lawra9 — Rappel Facture',
                body: notifMessage,
              },
              data: { url: '/dashboard' }
            });
            
            totalSent++;
            results.push({ userId, doc: data.name, type: target.label, status: 'sent' });
          } catch (pushError: any) {
            console.error(`Erreur push pour userId=${userId}:`, pushError.code);
            if (pushError.code === 'messaging/invalid-registration-token' ||
                pushError.code === 'messaging/registration-token-not-registered') {
               await adminDb.doc(`users/${userId}/settings/push`).update({
                   tokens: admin.firestore.FieldValue.arrayRemove(token)
               });
            }
            results.push({ userId, doc: data.name, type: target.label, status: 'error', code: pushError.code });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalNotificationsSent: totalSent,
      totalUsersChecked: usersSnap.size,
      details: results,
    });

  } catch (error: any) {
    console.error('Erreur Firebase Admin CRON:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
