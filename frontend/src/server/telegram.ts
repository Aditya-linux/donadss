import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { Task } from "@/lib/donads-api";
import { pendingApprovalForTask } from "@/lib/approvals";
import { claimTelegramUpdate, consumeTelegramLinkCode, getTelegramLink, putTelegramLinkCode, takeRateLimit } from "@/server/database";

const LINK_TTL_MS = 10 * 60 * 1_000;

function setting(name: string): string { return process.env[name]?.trim() ?? ""; }

export function telegramConfigured(): boolean {
  return Boolean(setting("TELEGRAM_BOT_TOKEN") && /^[A-Za-z0-9_]{5,32}$/.test(setting("TELEGRAM_BOT_USERNAME")) && setting("TELEGRAM_WEBHOOK_SECRET").length >= 32 && /^https:\/\//.test(setting("DONADS_PUBLIC_APP_URL")));
}

export function telegramWebhookAuthorized(value: string | null): boolean {
  const expected = setting("TELEGRAM_WEBHOOK_SECRET");
  if (!expected || !value) return false;
  const left = Buffer.from(value); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function telegramStartCode(text: string): string | null {
  const match = text.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?\s+(dn_[A-Za-z0-9_-]{12,64})$/);
  return match?.[1] ?? null;
}

function codeHash(code: string): string { return createHash("sha256").update(code).digest("hex"); }

export async function createTelegramLink(ownerId: string): Promise<{ url: string; expires_at_ms: number }> {
  if (!telegramConfigured()) throw new Error("Telegram notifications are not configured.");
  const code = `dn_${randomBytes(18).toString("base64url")}`;
  const expiresAtMs = Date.now() + LINK_TTL_MS;
  await putTelegramLinkCode(ownerId, codeHash(code), expiresAtMs);
  return { url: `https://t.me/${setting("TELEGRAM_BOT_USERNAME")}?start=${code}`, expires_at_ms: expiresAtMs };
}

async function telegramApi(method: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${setting("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Telegram API rejected ${method}.`);
}

export async function handleTelegramUpdate(update: unknown): Promise<void> {
  if (!telegramConfigured() || !update || typeof update !== "object") return;
  const envelope = update as { update_id?: unknown; message?: unknown };
  const updateId = Number(envelope.update_id);
  if (!Number.isSafeInteger(updateId) || updateId < 0 || !await claimTelegramUpdate(updateId)) return;
  const message = envelope.message;
  if (!message || typeof message !== "object") return;
  const item = message as { text?: unknown; chat?: { id?: unknown; type?: unknown; username?: unknown } };
  const chatId = String(item.chat?.id ?? "");
  if (!chatId || item.chat?.type !== "private" || typeof item.text !== "string") return;
  if (!await takeRateLimit(`telegram:${chatId}`, 12, 60_000)) return;
  const code = telegramStartCode(item.text);
  if (!code) {
    await telegramApi("sendMessage", { chat_id: chatId, text: "Open DONADS, connect your wallet, and choose Connect Telegram. This bot never signs transactions or asks for keys." });
    return;
  }
  const ownerId = await consumeTelegramLinkCode(codeHash(code), chatId, typeof item.chat?.username === "string" ? item.chat.username : null);
  await telegramApi("sendMessage", { chat_id: chatId, text: ownerId ? "DONADS notifications are connected to your wallet. Approvals still happen securely inside DONADS." : "This link is invalid, expired, or already used. Create a new link inside DONADS." });
}

export async function sendTelegramCheckpoint(task: Task): Promise<void> {
  if (!telegramConfigured()) return;
  const checkpoint = pendingApprovalForTask(task);
  if (!checkpoint) return;
  const link = await getTelegramLink(task.owner_id);
  if (!link) return;
  const appUrl = new URL(setting("DONADS_PUBLIC_APP_URL"));
  appUrl.searchParams.set("task", task.id);
  await telegramApi("sendMessage", {
    chat_id: link.chat_id,
    text: `DONADS needs your approval\n\n${checkpoint.title}\n${checkpoint.summary}\n\nOpen DONADS to inspect exact values. Telegram cannot approve or sign this action.`,
    reply_markup: { inline_keyboard: [[{ text: "Review in DONADS", url: appUrl.toString() }]] },
  });
}
