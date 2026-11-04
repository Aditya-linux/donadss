import { describe, expect, it } from "vitest";
import { planUnifiedTask } from "./task-planner";

describe("planUnifiedTask", () => {
  it("coordinates research and growth for sourced campaigns", () => {
    expect(planUnifiedTask("Research https://example.com and create a launch campaign").kind).toBe("operator");
  });
  it("routes EVM bytecode scans to Sentinel", () => {
    expect(planUnifiedTask("Scan this contract bytecode 0x6000ff")).toEqual({ kind: "sentinel", bytecode: "0x6000ff" });
  });
  it("asks for purchase details instead of claiming execution", () => {
    expect(planUnifiedTask("Buy me headphones")).toMatchObject({ kind: "clarify" });
  });
  it("creates an exact deterministic MON transfer plan", () => {
    expect(planUnifiedTask("Send 0.25 MON to 0x2222222222222222222222222222222222222222 for testing")).toEqual({
      kind: "flow",
      recipient: "0x2222222222222222222222222222222222222222",
      amount: "0.25",
      purpose: "Send 0.25 MON to 0x2222222222222222222222222222222222222222 for testing",
    });
  });
  it("asks for missing transfer fields", () => {
    expect(planUnifiedTask("Send MON to my friend")).toMatchObject({ kind: "clarify" });
  });
  it("does not claim trading is enabled", () => {
    expect(planUnifiedTask("Swap 1 MON for USDC")).toMatchObject({ kind: "clarify", message: expect.stringMatching(/not enabled/i) });
  });
});
