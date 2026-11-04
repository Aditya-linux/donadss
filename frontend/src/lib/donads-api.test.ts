import { describe, expect, it } from "vitest";

import { ApiError, extractSourceUrls } from "./donads-api";

describe("extractSourceUrls", () => {
  it("extracts and deduplicates public source URLs", () => {
    expect(
      extractSourceUrls(
        "Compare https://docs.monad.xyz and https://docs.monad.xyz against http://example.com/page.",
      ),
    ).toEqual(["https://docs.monad.xyz/", "http://example.com/page"]);
  });

  it("requires a source instead of inventing research", () => {
    expect(() => extractSourceUrls("Research Monad for me")).toThrow(ApiError);
  });

  it("enforces the source limit", () => {
    const prompt = Array.from(
      { length: 6 },
      (_, index) => `https://example.com/${index}`,
    ).join(" ");
    expect(() => extractSourceUrls(prompt)).toThrow(/up to 5/i);
  });
});
