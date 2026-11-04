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
      asset: "MON",
      tokenContract: null,
    });
  });
  it("creates an exact deterministic ERC-20 transfer plan", () => {
    expect(planUnifiedTask("Send 12.5 USDC token 0x1111111111111111111111111111111111111111 to 0x2222222222222222222222222222222222222222")).toEqual({
      kind: "flow", amount: "12.5", asset: "USDC", tokenContract: "0x1111111111111111111111111111111111111111",
      recipient: "0x2222222222222222222222222222222222222222",
      purpose: "Send 12.5 USDC token 0x1111111111111111111111111111111111111111 to 0x2222222222222222222222222222222222222222",
    });
  });
  it("asks for missing transfer fields", () => {
    expect(planUnifiedTask("Send MON to my friend")).toMatchObject({ kind: "clarify" });
  });
  it("requires explicit token contracts for a swap", () => {
    expect(planUnifiedTask("Swap 1 MON for USDC")).toMatchObject({ kind: "clarify", message: expect.stringMatching(/0xINPUT/i) });
  });
  it("builds a deterministic Uniswap quote request", () => {
    expect(planUnifiedTask("Swap 1 USDC token 0x1111111111111111111111111111111111111111 for DAI token 0x2222222222222222222222222222222222222222 max 0.5% slippage")).toMatchObject({
      kind: "swap", amount: "1", inputAsset: "USDC", outputAsset: "DAI", slippageBps: 50, maxPriceImpactBps: 200,
    });
  });
});
