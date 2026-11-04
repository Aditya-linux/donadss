import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatShell } from "./chat-shell";

describe("ChatShell", () => {
  afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

  it("uses one task surface and opens informational specialist details", async () => {
    const user = userEvent.setup();
    render(<ChatShell />);
    expect(screen.getByRole("heading", { name: "What should DONADS complete?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ask DONADS to complete a task")).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Learn about Scout" }));
    expect(screen.getByRole("heading", { name: "Scout" })).toBeInTheDocument();
    expect(screen.getByText("What it is good at")).toBeInTheDocument();
    expect(screen.getByText("Questions to ask")).toBeInTheDocument();
  });

  it("requires wallet identity before dispatching a real task", async () => {
    const user = userEvent.setup();
    render(<ChatShell />);
    await user.type(screen.getByLabelText("Ask DONADS to complete a task"), "Scan this contract bytecode 0x6000ff");
    await user.click(screen.getByRole("button", { name: "Start task" }));
    expect(await screen.findByText(/Connect and sign in with your wallet first/)).toBeInTheDocument();
  });

  it("selects and removes task attachments from the composer", async () => {
    const user = userEvent.setup();
    render(<ChatShell />);
    const file = new File(["Monad notes"], "notes.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText("Attach files", { selector: "input" }), file);
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove notes.md" }));
    expect(screen.queryByText("notes.md")).not.toBeInTheDocument();
  });
});
