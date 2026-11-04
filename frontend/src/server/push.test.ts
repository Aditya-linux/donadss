import { afterEach, describe, expect, it } from "vitest";
import { pushConfigured } from "@/server/push";

const original = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};

afterEach(() => {
  process.env.VAPID_PUBLIC_KEY = original.publicKey;
  process.env.VAPID_PRIVATE_KEY = original.privateKey;
  process.env.VAPID_SUBJECT = original.subject;
});

describe("Web Push configuration", () => {
  it("rejects malformed public keys", () => {
    process.env.VAPID_PUBLIC_KEY = "not-a-vapid-key";
    process.env.VAPID_PRIVATE_KEY = "private-placeholder";
    process.env.VAPID_SUBJECT = "mailto:security@example.com";
    expect(pushConfigured()).toBe(false);
  });

  it("requires an HTTPS or mailto contact subject", () => {
    process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");
    process.env.VAPID_PRIVATE_KEY = "private-placeholder";
    process.env.VAPID_SUBJECT = "security@example.com";
    expect(pushConfigured()).toBe(false);
  });

  it("accepts a structurally valid VAPID configuration", () => {
    process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");
    process.env.VAPID_PRIVATE_KEY = "private-placeholder";
    process.env.VAPID_SUBJECT = "mailto:security@example.com";
    expect(pushConfigured()).toBe(true);
  });
});
