import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Mascot, MascotLoader } from "./mascot";

describe("MascotLoader", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows specific progress and remains still for reduced-motion users", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const animationFrame = vi.spyOn(window, "requestAnimationFrame");
    render(<MascotLoader label="Verifying Monad receipt…" />);

    expect(screen.getByRole("status", { name: "Verifying Monad receipt…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Verifying Monad receipt…")).toBeInTheDocument();
    expect(animationFrame).not.toHaveBeenCalled();
  });

  it("cancels the canvas loop when the operation finishes", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { unmount } = render(<MascotLoader label="Working…" />);

    expect(request).toHaveBeenCalledOnce();
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
  it("keeps the approved mascot as meaningful product artwork", () => {
    render(<Mascot />);
    expect(screen.getByAltText("DONADS robot mascot")).toBeInTheDocument();
  });

