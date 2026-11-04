import type { Task } from "@/lib/donads-api";
import { sendCheckpointNotification } from "@/server/push";
import { sendTelegramCheckpoint } from "@/server/telegram";

export async function sendCheckpointNotifications(task: Task): Promise<void> {
  const results = await Promise.allSettled([sendCheckpointNotification(task), sendTelegramCheckpoint(task)]);
  for (const result of results) {
    if (result.status === "rejected") console.error("DONADS checkpoint notification failed", result.reason);
  }
}
