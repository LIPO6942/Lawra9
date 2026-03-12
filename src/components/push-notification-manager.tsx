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

  const checkSupport = useCallback(async () => {
    const ok = await isSupported();
    setSupported(ok);
    if (ok && user) {
      try {
        const messaging = getMessaging(app);
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (registration) {
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });
          if (token) setFcmToken(token);
        }
      } catch (e) {
        console.log('Firebase messaging not initialized yet or permission not granted');
      }
    }
  }, [user]);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  async function subscribeToPush() {
    if (!user) {
      alert('Tu dois être connecté.');
      return;
    }

    setLoading(true);
    try {
      let permission = Notification.permission;
      console.log('Etat actuel de la permission:', permission);

      if (permission === 'default') {
        console.log('1. Demande de permission au navigateur...');
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        alert('❌ Les notifications sont bloquées. Autorise-les dans les paramètres de ton navigateur (clique sur le cadenas dans la barre d\'adresse).');
        setLoading(false);
        return;
      }

      console.log('2. Enregistrement du Service Worker...');
      const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;
      
      const swRegistration = await navigator.serviceWorker.register(swUrl);
      
      // On attend explicitement que le Service Worker soit activé
      console.log('Attente du Service Worker prêt...');
      await navigator.serviceWorker.ready;
      
      console.log('3. Récupération du token Google FCM...');
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) throw new Error('Google n\'a pas renvoyé de Token.');

      console.log('4. Envoi du token au serveur Vercel...');
      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, token }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors de la sauvegarde sur le serveur');
      }

      setFcmToken(token);
      alert('✅ Notifications activées avec succès !');
    } catch (err: any) {
      console.error('Erreur complete:', err);
      alert('❌ Erreur : ' + (err.message || 'Problème de connexion avec Google'));
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
      alert('Notifications désactivées.');
    } catch (err) {
      console.error(err);
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
