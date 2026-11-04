import { describe, expect, it } from "vitest";
import { pushFailureMessage } from "@/lib/push-client";

describe("push client recovery messages", () => {
  it("turns denied permission into a recovery instruction", () => {
    expect(pushFailureMessage(new DOMException("denied", "NotAllowedError"))).toContain("site settings");
  });

  it("turns browser push-service failures into a retryable message", () => {
    expect(pushFailureMessage(new Error("Registration failed - push service error"))).toContain("could not reach its push service");
  });

  it("preserves a specific application error", () => {
    expect(pushFailureMessage(new Error("Phone alerts are not configured on this deployment yet."))).toBe("Phone alerts are not configured on this deployment yet.");
  });
});
