import { describe, expect, it } from "vitest";

import { executeBot, monToWei } from "./bots";

describe("Vercel specialist execution", () => {
  it("detects executable SELFDESTRUCT but ignores push data", async () => {
    const detected = await executeBot("sentinel", { bytecode: "0x60ff00ff" });
    expect(detected.state).toBe("completed");
    if (detected.state !== "completed" || !("threat_score" in detected.data)) throw new Error("Unexpected Sentinel result.");
    expect(detected.data.threat_score).toBe(60);
    expect(detected.data.findings).toHaveLength(1);
    expect(detected.data.findings[0].evidence).toContain("offset 3");
  });

  it("prepares a non-custodial Monad intent without claiming execution", async () => {
    const result = await executeBot("flow", {
      title: "Test transfer",
      purpose: "Verify Flow",
      payer: "0x1111111111111111111111111111111111111111",
      payouts: [{ recipient_name: "Recipient", recipient_address: "0x2222222222222222222222222222222222222222", asset: "MON", amount: "0.25", milestone: "Test", deadline: null }],
      approval_conditions: ["Exact values reviewed"],
      linked_task_id: null,
    });
    expect(result.state).toBe("completed");
    if (result.state !== "completed" || !("workflow" in result.data) || !("execution_available" in result.data)) throw new Error("Unexpected Flow result.");
    expect(result.data.workflow.state).toBe("awaiting_approval");
    expect("submission" in result.data.workflow ? result.data.workflow.submission : undefined).toBeNull();
    expect(result.data.execution_available).toBe(false);
    expect(monToWei("0.25")).toBe(BigInt("250000000000000000"));
  });

  it("prepares a bounded native MON batch with a computed total", async () => {
    const result = await executeBot("flow", {
      title: "Batch", purpose: "Pay contributors", payer: "0x1111111111111111111111111111111111111111",
      payouts: [
        { recipient_name: "A", recipient_address: "0x2222222222222222222222222222222222222222", asset: "MON", amount: "0.01", milestone: "Test", deadline: null },
        { recipient_name: "B", recipient_address: "0x3333333333333333333333333333333333333333", asset: "MON", amount: "0.01", milestone: "Test", deadline: null },
      ], approval_conditions: ["Exact batch reviewed"], linked_task_id: null,
    });
    expect(result.state).toBe("completed");
    if (result.state !== "completed" || !("workflow" in result.data) || !("payouts" in result.data.workflow)) throw new Error("Unexpected Flow result.");
    expect(result.data.workflow.payouts).toHaveLength(2);
    expect(result.data.workflow.totals[0]).toEqual({ asset: "MON", amount: "0.02" });
    expect(result.data.workflow.submissions).toEqual([]);
  });

  it("rejects duplicate batch recipients", async () => {
    await expect(executeBot("flow", {
      title: "Batch", purpose: "Pay contributors", payer: "0x1111111111111111111111111111111111111111",
      payouts: [
        { recipient_name: "A", recipient_address: "0x2222222222222222222222222222222222222222", asset: "MON", amount: "0.01", milestone: "Test", deadline: null },
        { recipient_name: "A again", recipient_address: "0x2222222222222222222222222222222222222222", asset: "MON", amount: "0.01", milestone: "Test", deadline: null },
      ], approval_conditions: [], linked_task_id: null,
    })).rejects.toThrow(/unique/i);
  });

  it("rejects an Operator graph with a forward dependency", async () => {
    await expect(executeBot("operator", {
      objective: "Invalid graph",
      target_date: null,
      steps: [{ id: "first", title: "First", bot: "growth", prompt: "Draft", input: {}, depends_on: ["later"] }],
    })).rejects.toThrow(/earlier step/i);
  });

  it("blocks private Scout targets without making a request", async () => {
    const result = await executeBot("scout", { sources: ["http://127.0.0.1/private"] });
    expect(result.state).toBe("completed");
    if (result.state !== "completed" || !("report" in result.data)) throw new Error("Unexpected Scout result.");
    expect(result.data.report.sources[0].status).toBe("failed");
    expect(result.data.report.sources[0].error).toMatch(/private|reserved/i);
  });
});
