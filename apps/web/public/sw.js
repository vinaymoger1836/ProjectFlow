/* ProjectFlow service worker: shows web push notifications and focuses the app on click. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'ProjectFlow', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ProjectFlow';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        return existing.focus().then((client) => (client && 'navigate' in client ? client.navigate(target.href) : undefined));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
