import { api } from './api';

const SERVICE_WORKER_URL = '/sw.js';

export type PushSupport = 'supported' | 'unsupported' | 'denied';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission === 'denied' ? 'denied' : 'supported';
}

/** The active push subscription for this browser, if any. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() === 'unsupported') return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Asks for permission, subscribes with the server's VAPID key, and registers the subscription.
 * Throws with a user-facing message when permission is refused.
 */
export async function enablePush(vapidPublicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for this site. Allow them in your browser settings to enable push.');
  }

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 500),
  });
}

export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await api.removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
