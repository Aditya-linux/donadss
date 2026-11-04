import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatShell } from "./chat-shell";

describe("ChatShell", () => {
  afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

  it("uses one task surface and presents specialists as information", () => {
    render(<ChatShell />);
    expect(screen.getByRole("heading", { name: "What should DONADS complete?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ask DONADS to complete a task")).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open Scout specialist/i })).not.toBeInTheDocument();
  });

  it("requires wallet identity before dispatching a real task", async () => {
    const user = userEvent.setup();
    render(<ChatShell />);
    await user.type(screen.getByLabelText("Ask DONADS to complete a task"), "Scan this contract bytecode 0x6000ff");
    await user.click(screen.getByRole("button", { name: "Start task" }));
    expect(await screen.findByText(/Connect and sign in with your wallet first/)).toBeInTheDocument();
  });
});
