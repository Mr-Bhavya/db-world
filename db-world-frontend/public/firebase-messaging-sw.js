/* Firebase Cloud Messaging service worker — shows notifications for BACKGROUND pushes (app closed
 * or unfocused). It runs in its own worker context with no access to Vite env, so the PUBLIC
 * Firebase web config is inlined here (the same non-secret values that already ship in the app
 * bundle). Keep the compat SDK version in sync with the `firebase` npm package. */

importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBKhm-bIhGeSb8-u-yP5C9HiZaSdylkxVs',
  authDomain: 'db-world-in.firebaseapp.com',
  projectId: 'db-world-in',
  storageBucket: 'db-world-in.firebasestorage.app',
  messagingSenderId: '971255775322',
  appId: '1:971255775322:web:ec894537dcce9859cf1863',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || 'DB World', {
    body: n.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data,
    tag: data.ipoId || undefined,
  });
});

// Tapping a notification deep-links to wherever `data.link` points (each notification sets its
// own — e.g. an IPO detail path), falling back to the app home. Focuses an existing tab if open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.link || '/db-world';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
    return undefined;
  })());
});
