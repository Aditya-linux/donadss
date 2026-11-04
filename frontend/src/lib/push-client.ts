import { getPushConfig, removePushSubscription, savePushSubscription } from "@/lib/donads-api";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const key = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (key.length !== 65 || key[0] !== 4) throw new Error("Phone alerts are misconfigured. Replace the VAPID key pair in Vercel.");
  return key;
}

function sameKey(left: ArrayBuffer | null, right: Uint8Array<ArrayBuffer>): boolean {
  if (!left) return false;
  const current = new Uint8Array(left);
  return current.length === right.length && current.every((value, index) => value === right[index]);
}

export function pushFailureMessage(reason: unknown): string {
  if (reason instanceof DOMException && reason.name === "NotAllowedError") return "Notifications are blocked for DONADS. Allow them in your browser site settings, then try again.";
  if (reason instanceof DOMException && reason.name === "AbortError") return "Your browser push service did not respond. Check the network, disable VPN or strict tracking protection temporarily, then try again.";
  const message = reason instanceof Error ? reason.message : "";
  if (/registration failed|push service|service error/i.test(message)) return "Your browser could not reach its push service. Check the network and notification settings, then try again.";
  return message || "Phone alerts could not be updated. Try again.";
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  if (!pushSupported()) throw new Error("This browser does not support Web Push.");
  const registered = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await registered.update().catch(() => undefined);
  return navigator.serviceWorker.ready;
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
  const key = applicationServerKey(config.public_key);
  let existing = await serviceWorker.pushManager.getSubscription();
  if (existing && !sameKey(existing.options.applicationServerKey, key)) {
    await removePushSubscription(existing.endpoint).catch(() => undefined);
    await existing.unsubscribe();
    existing = null;
  }
  const subscription = existing ?? await serviceWorker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await savePushSubscription(subscription.toJSON());
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
