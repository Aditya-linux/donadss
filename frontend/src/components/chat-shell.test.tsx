import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletConnectionCancelledError } from "@/lib/wallet-provider";
import { ChatShell } from "./chat-shell";

const walletMocks = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock("@/lib/wallet-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/wallet-provider")>(),
  connectWalletProvider: walletMocks.connect,
}));

describe("ChatShell", () => {
  afterEach(() => { vi.unstubAllGlobals(); walletMocks.connect.mockReset(); window.localStorage.clear(); });

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

  it("returns to the idle workspace when the wallet chooser is cancelled", async () => {
    walletMocks.connect.mockRejectedValueOnce(new WalletConnectionCancelledError());
    const user = userEvent.setup();
    render(<ChatShell />);

    const connectButton = screen.getByRole("button", { name: "Connect wallet" });
    await user.click(connectButton);

    await waitFor(() => expect(connectButton).toBeEnabled());
    expect(screen.queryByText("Opening the wallet chooser…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What should DONADS complete?" })).toBeInTheDocument();
  });
});
