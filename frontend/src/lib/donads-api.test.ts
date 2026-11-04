import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  captureOperatorRoutine,
  extractSourceUrls,
  runOperatorRoutine,
} from "./donads-api";

afterEach(() => vi.unstubAllGlobals());

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

describe("Operator routines API", () => {
  it("captures only through the completed-task routine endpoint", async () => {
    const payload = {
      id: "research-draft",
      name: "Research draft",
      description: "Approved workflow",
      version: 1,
      created_at_ms: 1,
      updated_at_ms: 1,
      input: { objective: "Research", target_date: null, steps: [] },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      captureOperatorRoutine("task-1", {
        id: payload.id,
        name: payload.name,
        description: payload.description,
      }),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/v1/tasks/task-1/routine",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("replays a routine as a fresh task", async () => {
    const payload = { id: "task-2", status: { state: "queued" } };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(runOperatorRoutine("research draft")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/v1/routines/research%20draft/runs",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
