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
});
