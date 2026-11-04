import { beforeEach, describe, expect, it } from "vitest";

import { forgetPendingFlowHash, readPendingFlowHash, rememberPendingFlowHash } from "./flow-submission";

describe("Flow submission recovery", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists a wallet hash until receipt verification completes", () => {
    const hash = `0x${"ab".repeat(32)}`;
    rememberPendingFlowHash("task-1", hash.toUpperCase().replace("0X", "0x"));
    expect(readPendingFlowHash("task-1")).toBe(hash);
    forgetPendingFlowHash("task-1");
    expect(readPendingFlowHash("task-1")).toBeNull();
  });

  it("rejects malformed wallet hashes", () => {
    expect(() => rememberPendingFlowHash("task-1", "0x1234")).toThrow(/invalid transaction hash/i);
  });
});
