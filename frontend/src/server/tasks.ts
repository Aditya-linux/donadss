import { randomUUID } from "node:crypto";

import type { Task } from "@/lib/donads-api";
import { executeBot } from "@/server/bots";
import { insertTask, updateTask } from "@/server/database";
import { taskEvent } from "@/server/donads-types";

export async function createAndExecuteTask(
  ownerId: string,
  payload: Record<string, unknown>,
): Promise<Task> {
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const bot = typeof payload.bot === "string" ? payload.bot.trim().toLowerCase() : "";
  if (!prompt) throw new Error("prompt is required.");
  if (!bot) throw new Error("bot is required.");
  const now = Date.now();
  const task = {
    id: randomUUID(), owner_id: ownerId, prompt, bot, input: payload.input ?? {},
    events: [{ sequence: 1, kind: "queued", message: `${bot} task accepted.`, at_ms: now }],
    created_at_ms: now, updated_at_ms: now, feedback: null, status: { state: "running" as const },
  } as Task;
  await insertTask(task);
  try {
    task.status = await executeBot(bot, task.input) as Task["status"];
    task.updated_at_ms = Date.now();
    task.events.push(taskEvent(task.events, "completed", task.status.state === "completed" ? task.status.summary : "Task completed."));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Specialist execution failed.";
    task.status = { state: "failed", error: message, latency_ms: Date.now() - now };
    task.updated_at_ms = Date.now();
    task.events.push(taskEvent(task.events, "failed", message));
  }
  await updateTask(task);
  return task;
}
