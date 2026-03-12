'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { app } from '@/lib/firebase';

export function PushNotificationManager() {
  const [supported, setSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Vérifie si FCM est supporté par ce navigateur
  const checkSupport = useCallback(async () => {
    const ok = await isSupported();
    setSupported(ok);
    if (ok) {
      // Vérifie si on a déjà un token
      try {
        const messaging = getMessaging(app);
        const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;
        const existingToken = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.register(swUrl),
        });
        if (existingToken) {
          setFcmToken(existingToken);
        }
      } catch {
        // Pas encore autorisé, c'est normal
      }
    }
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  async function subscribeToPush() {
    if (!user) {
      alert('Tu dois être connecté pour activer les notifications.');
      return;
    }

    setLoading(true);
    try {
      // Demande la permission au navigateur
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('❌ Permission refusée. Active les notifications dans les paramètres de ton navigateur.');
        setLoading(false);
        return;
      }

      const messaging = getMessaging(app);
      const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;
      const swRegistration = await navigator.serviceWorker.register(swUrl);

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        throw new Error('Impossible d\'obtenir le token FCM.');
      }

      setFcmToken(token);

      // Enregistre le token FCM dans Firestore via notre route API
      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, token }),
      });

      if (!res.ok) throw new Error('Erreur lors de l\'enregistrement.');

      alert('✅ Notifications activées avec succès !');
    } catch (err: any) {
      console.error('Erreur abonnement push:', err);
      alert('❌ Impossible d\'activer les notifications. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    if (!user) return;
    setLoading(true);
    try {
      const messaging = getMessaging(app);
      await deleteToken(messaging);
      setFcmToken(null);

      await fetch('/api/web-push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
    } catch (err) {
      console.error('Erreur désabonnement:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground">
      <div className="flex items-start gap-3">
        {fcmToken
          ? <Bell className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          : <BellOff className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        }
        <div>
          <p className="font-semibold text-sm">Notifications de rappel</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fcmToken
              ? 'Actives — tu reçois les alertes factures sur cet appareil.'
              : 'Inactive — active-les pour être rappelé avant les échéances.'}
          </p>
        </div>
      </div>
      <Button
        variant={fcmToken ? 'outline' : 'default'}
        size="sm"
        onClick={fcmToken ? unsubscribeFromPush : subscribeToPush}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {fcmToken ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}
