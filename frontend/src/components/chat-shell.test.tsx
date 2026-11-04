import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const taskId = "398d234b-e175-4008-aaff-73250b2028d3";
const jsonResponse = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const baseTask = { id: taskId, prompt: "Task", bot: "scout", input: {}, events: [], created_at_ms: 1, updated_at_ms: 1, feedback: null };

describe("ChatShell", () => {
  afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

  it("renders Scout and navigates to every current specialist", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ error: "not found" }, 404)));
    const user = userEvent.setup(); render(<ChatShell />);
    expect(screen.getByRole("heading", { name: "Research with receipts." })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Growth specialist" })); expect(screen.getByRole("heading", { name: "Campaign brief" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Operator specialist" })); expect(screen.getByRole("heading", { name: "One objective. Ordered work." })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Flow specialist" })); expect(screen.getByRole("heading", { name: "Monad transfer" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Commerce specialist" })); expect(screen.getByRole("heading", { name: "Crypto commerce intent" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Sentinel specialist" })); expect(screen.getByRole("heading", { name: "Sentinel bytecode triage" })).toBeInTheDocument();
  });

  it("prepares a crypto Commerce intent without payment claims", async () => {
    const completed = { ...baseTask, bot: "commerce", status: { state: "completed", summary: "Intent prepared.", latency_ms: 1, data: { agent_version: "commerce-crypto-intent-v1", execution_available: false, blocked_reason: "Merchant adapter missing.", workflow: { id: "commerce-test", objective: "Buy keyboard", state: "awaiting_approval", selected_offer: { id: "offer-1", name: "Keyboard", merchant: "Crypto Store", source_url: "https://shop.example/item", checkout_url: "https://shop.example/item", total_atomic: "2", asset: "MON", in_stock: true, rating: null, evidence_note: "User supplied", crypto_payment_supported: true }, alternatives_considered: 1, budget_atomic: "3", total_atomic: "2", asset: "MON", approval_id: null, approved_at_ms: null, audit_history: [] } } } };
    const fetchMock = vi.fn().mockImplementationOnce(() => jsonResponse({ ...baseTask, bot: "commerce", status: { state: "queued" } }, 202)).mockImplementationOnce(() => jsonResponse(completed));
    vi.stubGlobal("fetch", fetchMock); const user = userEvent.setup(); render(<ChatShell />); await user.click(screen.getByRole("button", { name: "Open Commerce specialist" }));
    await user.type(screen.getByLabelText("Purchase goal"), "Buy keyboard"); await user.type(screen.getByLabelText("Budget in atomic units"), "3"); await user.type(screen.getByLabelText("Product"), "Keyboard"); await user.type(screen.getByLabelText("Crypto-accepting merchant"), "Crypto Store"); await user.type(screen.getByLabelText("Merchant evidence/checkout URL"), "https://shop.example/item"); await user.type(screen.getByLabelText("Exact total in atomic units"), "2"); await user.click(screen.getByRole("button", { name: "Prepare crypto intent" }));
    expect(await screen.findByRole("heading", { name: "Keyboard" })).toBeInTheDocument(); expect(screen.getByText(/does not sign, broadcast, or place an order/)).toBeInTheDocument();
  });

  it("binds Flow preparation to the connected Monad wallet", async () => {
    const wallet = "0x2222222222222222222222222222222222222222";
    const workflow = { id: "flow-test", title: "Monad transfer", purpose: "Pay contributor", payer: wallet, network: "Monad Testnet", chain_id: 10143, state: "awaiting_approval", payouts: [{ recipient_name: "Recipient", recipient_address: "0x1111111111111111111111111111111111111111", asset: "MON", amount: "1", milestone: "Pay contributor", deadline: null }], totals: [{ asset: "MON", amount: "1" }], approval_conditions: [], linked_task_id: null, approval: null, execution: null, audit_history: [] };
    const completed = { ...baseTask, bot: "flow", status: { state: "completed", summary: "Intent prepared.", latency_ms: 1, data: { agent_version: "flow-crypto-intent-v1", execution_available: false, blocked_reason: "Awaiting wallet.", workflow } } };
    const fetchMock = vi.fn().mockImplementationOnce(() => jsonResponse({ ...baseTask, bot: "flow", status: { state: "queued" } }, 202)).mockImplementationOnce(() => jsonResponse(completed));
    const provider = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_requestAccounts" ? [wallet] : null) };
    vi.stubGlobal("fetch", fetchMock); vi.stubGlobal("ethereum", provider); const user = userEvent.setup(); render(<ChatShell />); await user.click(screen.getByRole("button", { name: "Open Flow specialist" })); await user.click(screen.getByRole("button", { name: "Connect wallet" }));
    await user.type(screen.getByLabelText("Purpose"), "Pay contributor"); await user.type(screen.getByLabelText("Recipient address"), workflow.payouts[0].recipient_address); await user.type(screen.getByLabelText("Amount in MON"), "1"); await user.click(screen.getByRole("button", { name: "Prepare exact transfer" }));
    expect(await screen.findByText(/Completion requires a successful RPC receipt/)).toBeInTheDocument(); expect(provider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
  });

  it("runs Sentinel bytecode triage from the interface", async () => {
    const completed = { ...baseTask, bot: "sentinel", status: { state: "completed", summary: "Sentinel found 1 high-confidence risk signal(s); threat score 60/100.", latency_ms: 1, data: { threat_score: 60, bytecode_bytes: 3, findings: [{ id: "SELFDESTRUCT_REACHABLE", severity: "critical", title: "Contract contains SELFDESTRUCT", evidence: "opcode 0xff at byte offset 2" }], scope: "opcode-presence-v1", disclaimer: "Triage only" } } };
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => jsonResponse({ ...baseTask, bot: "sentinel", status: { state: "queued" } }, 202)).mockImplementationOnce(() => jsonResponse(completed)));
    const user = userEvent.setup(); render(<ChatShell />); await user.click(screen.getByRole("button", { name: "Open Sentinel specialist" })); await user.type(screen.getByLabelText("Contract bytecode"), "0x6000ff"); await user.click(screen.getByRole("button", { name: "Scan bytecode" }));
    expect(await screen.findByText("Contract contains SELFDESTRUCT")).toBeInTheDocument(); expect(screen.getByText("60")).toBeInTheDocument();
  });
});
