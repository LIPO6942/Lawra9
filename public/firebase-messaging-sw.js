// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Récupérer la config Firebase depuis l'URL d'enregistrement du Service Worker
const urlParams = new URLSearchParams(location.search);
const apiKey = urlParams.get('apiKey');
const projectId = urlParams.get('projectId');
const messagingSenderId = urlParams.get('messagingSenderId');
const appId = urlParams.get('appId');

// Si la clé est présente, on initialise Firebase (évite le crash au premier load si vide)
if (apiKey) {
  firebase.initializeApp({ apiKey, projectId, messagingSenderId, appId });

  const messaging = firebase.messaging();

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
}

// Quand l'utilisateur clique sur la notification
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard'));
});
