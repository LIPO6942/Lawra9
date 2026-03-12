self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png', // Remplace par l'icône de ton app si tu en as une (dans le dossier public)
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // Tu peux renvoyer vers une page spécifique quand on clique dessus (ex: tableau de bord)
  event.waitUntil(clients.openWindow('/dashboard'));
});
