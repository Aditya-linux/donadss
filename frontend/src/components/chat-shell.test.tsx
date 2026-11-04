import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletConnectionCancelledError } from "@/lib/wallet-provider";
import type { Task } from "@/lib/donads-api";
import { ChatShell, DeleteHistoryDialog } from "./chat-shell";

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
    await user.click(screen.getByRole("button", { name: "Specialists" }));
    expect(screen.getByText("Scout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Learn about Scout" }));
    expect(screen.getByRole("heading", { name: "Scout" })).toBeInTheDocument();
    expect(screen.getByText("What it is good at")).toBeInTheDocument();
    expect(screen.getByText("Questions to ask")).toBeInTheDocument();
  });

  it("uses the shared responsive shell, workspace, and composer widths", () => {
    render(<ChatShell />);

    expect(screen.getByLabelText("DONADS navigation")).toHaveClass("donads-sidebar");
    expect(screen.getByRole("heading", { name: "What should DONADS complete?" }).closest(".donads-workspace-width")).not.toBeNull();
    expect(screen.getByLabelText("Ask DONADS to complete a task").closest("form")).toHaveClass("donads-workspace-width");
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

describe("DeleteHistoryDialog", () => {
  it("requires explicit confirmation and explains receipt retention", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const task = {
      id: "task-1",
      title: "Monad research brief",
      prompt: "Research Monad",
      bot: "scout",
      status: { state: "failed", error: "Source unavailable", latency_ms: 1 },
    } as Task;

    render(<DeleteHistoryDialog task={task} working={false} error={null} onClose={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByRole("heading", { name: "Delete from history?" })).toBeInTheDocument();
    expect(screen.getByText(/transaction receipts and security audit evidence remain preserved/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete history" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
