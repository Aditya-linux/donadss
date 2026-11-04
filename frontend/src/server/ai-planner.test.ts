import { afterEach, describe, expect, it, vi } from "vitest";
import { planTask } from "./ai-planner";

describe("AI planner fallback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses deterministic routing when the Gemini key is absent", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await planTask("0x1111111111111111111111111111111111111111", "Research https://example.com");
    expect(result.mode).toBe("deterministic");
    expect(result.plan.kind).toBe("scout");
    expect(result.fallback_reason).toMatch(/not configured/i);
  });

  it("keeps payments at a clarification boundary without the model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await planTask("0x1111111111111111111111111111111111111111", "Pay this person");
    expect(result.plan.kind).toBe("clarify");
  });
});
