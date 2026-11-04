import { getPushConfig, removePushSubscription, savePushSubscription } from "@/lib/donads-api";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  if (!pushSupported()) throw new Error("This browser does not support Web Push.");
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

export async function enablePushNotifications(): Promise<void> {
  const config = await getPushConfig();
  if (!config.configured || !config.public_key) throw new Error("Phone alerts are not configured on this deployment yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const serviceWorker = await registration();
  const existing = await serviceWorker.pushManager.getSubscription();
  const subscription = existing ?? await serviceWorker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(config.public_key) });
  await savePushSubscription(subscription.toJSON());
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
