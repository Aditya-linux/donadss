import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Mascot, MascotLoader } from "./mascot";

describe("DONADS mascot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the approved mascot as meaningful product artwork", () => {
    render(<Mascot />);
    expect(screen.getByAltText("DONADS robot mascot")).toBeInTheDocument();
  });

  it("announces the exact ongoing task while the pose sequence runs", () => {
    vi.useFakeTimers();
    render(<MascotLoader label="Comparing three products…" />);

    expect(screen.getByRole("status", { name: "Comparing three products…" })).toBeInTheDocument();
    expect(screen.getByText("Comparing three products…")).toBeInTheDocument();
  });
});
