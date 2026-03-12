'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const checkSubscription = useCallback(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const existingSub = await registration.pushManager.getSubscription();
    setSubscription(existingSub);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, [checkSubscription]);

  async function subscribeToPush() {
    if (!user) {
      alert('Tu dois être connecté pour activer les notifications.');
      return;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        throw new Error('Clé VAPID manquante. Vérifie NEXT_PUBLIC_FIREBASE_VAPID_KEY.');
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      setSubscription(sub);

      // Enregistre l'abonnement dans Firestore via notre route API
      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, subscription: sub }),
      });

      if (!res.ok) throw new Error('Erreur lors de l\'enregistrement.');

      alert('✅ Notifications activées ! Tu recevras des rappels pour tes factures.');
    } catch (err) {
      console.error('Erreur abonnement push:', err);
      alert('❌ Impossible d\'activer les notifications. Vérifie que tu as bien autorisé le site.');
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    if (!subscription || !user) return;
    setLoading(true);
    try {
      await subscription.unsubscribe();
      setSubscription(null);

      // Supprime l'abonnement de Firestore
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

  if (!isSupported) return null;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground">
      <div className="flex items-start gap-3">
        {subscription
          ? <Bell className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          : <BellOff className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        }
        <div>
          <p className="font-semibold text-sm">Notifications de rappel</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subscription
              ? 'Actives — tu reçois les alertes factures sur cet appareil.'
              : 'Inactive — active-les pour être rappelé avant les échéances.'}
          </p>
        </div>
      </div>
      <Button
        variant={subscription ? 'outline' : 'default'}
        size="sm"
        onClick={subscription ? unsubscribeFromPush : subscribeToPush}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {subscription ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}
