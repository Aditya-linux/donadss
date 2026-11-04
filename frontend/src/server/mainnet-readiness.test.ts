import { describe, expect, it } from "vitest";

import { mainnetReadiness } from "@/server/mainnet-readiness";

describe("mainnet readiness", () => {
  it("cannot enable mainnet from evidence flags alone", () => {
    const result = mainnetReadiness(100);
    expect(result.ready).toBe(false);
    expect(result.network_enabled).toBe(false);
  });

  it("requires ten verified testnet receipts", () => {
    expect(mainnetReadiness(9).gates[0].passed).toBe(false);
    expect(mainnetReadiness(10).gates[0].passed).toBe(true);
  });
});
