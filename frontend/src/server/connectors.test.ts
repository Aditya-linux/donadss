import { afterEach, describe, expect, it } from "vitest";

import { connectorCatalog } from "@/server/connectors";

describe("connector catalog", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it("fails closed when credentials are absent", () => {
    delete process.env.SLACK_CLIENT_ID;
    expect(connectorCatalog().find((item) => item.id === "slack")?.configured).toBe(false);
  });

  it("never grants financial authority", () => {
    expect(connectorCatalog().every((item) => item.financial_authority === false)).toBe(true);
  });
});
