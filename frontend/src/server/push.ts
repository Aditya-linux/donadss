import webpush from "web-push";

import type { Task } from "@/lib/donads-api";
import { pendingApprovalForTask } from "@/lib/approvals";
import { deletePushSubscription, listPushSubscriptions } from "@/server/database";

export function pushConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/i.test(subject)) return false;
  try {
    const decoded = Buffer.from(publicKey.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return decoded.length === 65 && decoded[0] === 4;
  } catch {
    return false;
  }
}

export function publicVapidKey(): string | null {
  return pushConfigured() ? process.env.VAPID_PUBLIC_KEY!.trim() : null;
}

export async function sendCheckpointNotification(task: Task): Promise<void> {
  const checkpoint = pendingApprovalForTask(task);
  if (!checkpoint || !pushConfigured()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!.trim(), process.env.VAPID_PUBLIC_KEY!.trim(), process.env.VAPID_PRIVATE_KEY!.trim());
  const subscriptions = await listPushSubscriptions(task.owner_id);
  const payload = JSON.stringify({
    title: "DONADS needs your approval",
    body: "A task is paused at a verified checkpoint. Open DONADS to review the exact values.",
    tag: `donads-${task.id}-${checkpoint.kind}`,
    url: "/",
  });
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 5 * 60, urgency: "high" });
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await deletePushSubscription(task.owner_id, subscription.endpoint);
      else throw error;
    }
  }));
}
