// Firebase Messaging Service Worker
// Importe les scripts Firebase nécessaires (version compat pour les service workers)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialise Firebase dans le service worker
// Note: seuls les champs nécessaires au messaging sont requis ici
firebase.initializeApp({
  apiKey: 'placeholder', // sera remplacé par le vrai config côté client
  projectId: 'placeholder',
  messagingSenderId: 'placeholder',
  appId: 'placeholder',
});

const messaging = firebase.messaging();

// Gère les messages reçus en arrière-plan (quand l'onglet n'est pas actif)
messaging.onBackgroundMessage(function (payload) {
  console.log('[SW] Message reçu en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || '🧾 Lawra9 — Rappel';
  const notificationOptions = {
    body: payload.notification?.body || 'Vous avez un rappel de facture.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Quand l'utilisateur clique sur la notification
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard'));
});
