import { afterEach, describe, expect, it } from "vitest";

import { telegramConfigured, telegramStartCode, telegramWebhookAuthorized } from "@/server/telegram";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("Telegram connector security", () => {
  it("accepts only bounded start-link commands", () => {
    expect(telegramStartCode("/start dn_abcdefghijklmnop")).toBe("dn_abcdefghijklmnop");
    expect(telegramStartCode("approve 1 MON")).toBeNull();
    expect(telegramStartCode("/start https://evil.example")).toBeNull();
  });

  it("requires a constant-time matching webhook secret", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "x".repeat(32);
    expect(telegramWebhookAuthorized("x".repeat(32))).toBe(true);
    expect(telegramWebhookAuthorized("y".repeat(32))).toBe(false);
    expect(telegramWebhookAuthorized(null)).toBe(false);
  });

  it("stays disabled until every server-side setting is valid", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:token";
    process.env.TELEGRAM_BOT_USERNAME = "donads_bot";
    process.env.TELEGRAM_WEBHOOK_SECRET = "s".repeat(32);
    process.env.DONADS_PUBLIC_APP_URL = "https://donads.example";
    expect(telegramConfigured()).toBe(true);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(telegramConfigured()).toBe(false);
  });
});
