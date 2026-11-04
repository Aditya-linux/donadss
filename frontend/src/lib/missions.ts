import { encodeFunctionData, keccak256 } from "viem";

import type { CommerceCompletedTask, FlowCompletedTask, OperatorCompletedTask, Task } from "@/lib/donads-api";

export type MissionState =
  | "running"
  | "awaiting_approval"
  | "authorized"
  | "submitted"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export type MissionEvent = {
  sequence: number;
  kind: string;
  message: string;
  at_ms: number;
};

export type Mission = {
  id: string;
  task_id: string;
  owner_id: string;
  objective: string;
  specialist: string;
  state: MissionState;
  version: number;
  created_at_ms: number;
  updated_at_ms: number;
  events: MissionEvent[];
};

export type TypedTransactionIntent = {
  id: string;
  task_id: string;
  kind: "native_transfer" | "erc20_transfer";
  chain_id: 10143;
  sender: string;
  recipient: string;
  asset: string;
  amount: string;
  amount_atomic: string | null;
  token_contract: string | null;
  calldata: `0x${string}`;
  calldata_hash: `0x${string}`;
  state: string;
  idempotency_key: string;
  approval: unknown;
  submission: unknown;
  execution: unknown;
};

export function missionStateForTask(task: Task): MissionState {
  if (task.status.state === "failed") return "failed";
  if (task.status.state === "queued" || task.status.state === "running") return "running";
  if (task.bot === "flow") {
    const state = (task as FlowCompletedTask).status.data.workflow.state;
    if (state === "awaiting_approval") return "awaiting_approval";
    if (state === "authorized") return "authorized";
    if (state === "submitted") return "submitted";
    if (state === "rejected") return "cancelled";
    return "completed";
  }
  if (task.bot === "commerce") {
    const state = (task as CommerceCompletedTask).status.data.workflow.state;
    if (state === "awaiting_approval") return "awaiting_approval";
    if (state === "authorized" || state === "invoice_created") return "authorized";
    if (state === "payment_submitted") return "verifying";
    if (state === "rejected") return "cancelled";
    return "completed";
  }
  if (task.bot === "operator") {
    const state = (task as OperatorCompletedTask).status.data.workflow.state;
    if (state === "planned") return "awaiting_approval";
    if (state === "cancelled") return "cancelled";
    if (state === "failed" || state === "partial_failure") return "failed";
    if (state === "completed") return "completed";
    return "running";
  }
  return "completed";
}
export function transactionIntentForTask(task: Task): TypedTransactionIntent | null {
  if (task.status.state !== "completed" || task.bot !== "flow") return null;
  const flowTask = task as FlowCompletedTask;
  const workflow = flowTask.status.data.workflow;
  const payout = workflow.payouts[0];
  if (!payout) return null;
  const calldata = workflow.transfer_kind === "erc20" && workflow.token && payout.amount_atomic
    ? encodeFunctionData({
      abi: [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
      functionName: "transfer",
      args: [payout.recipient_address as `0x${string}`, BigInt(payout.amount_atomic)],
    })
    : "0x";
  return {
    id: workflow.id,
    task_id: task.id,
    kind: workflow.transfer_kind === "erc20" ? "erc20_transfer" : "native_transfer",
    chain_id: 10143,
    sender: workflow.payer,
    recipient: payout.recipient_address,
    asset: payout.asset,
    amount: payout.amount,
    amount_atomic: payout.amount_atomic ?? null,
    token_contract: workflow.token?.contract ?? null,
    calldata,
    calldata_hash: keccak256(calldata),
    state: workflow.state,
    idempotency_key: `flow:${workflow.id}`,
    approval: workflow.approval,
    submission: workflow.submission,
    execution: workflow.execution,
  };
}
