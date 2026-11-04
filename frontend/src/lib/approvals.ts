import type { Task } from "@/lib/donads-api";

export const APPROVAL_REMINDER_AFTER_MS = 2 * 60 * 1_000;

export type PendingApproval = {
  task_id: string;
  bot: "flow" | "commerce" | "operator";
  kind: "intent_review" | "wallet_signature" | "receipt_verification" | "workflow_start";
  title: string;
  summary: string;
  state: string;
  requested_at_ms: number;
  reminder_due: boolean;
};

export function pendingApprovalForTask(task: Task, now = Date.now()): PendingApproval | null {
  if (task.status.state !== "completed") return null;

  if (task.bot === "flow") {
    const workflow = task.status.data.workflow;
    if (workflow.state === "awaiting_approval") {
      const payout = workflow.payouts[0];
      if (!payout) return null;
      return approval(task, now, {
        bot: "flow",
        kind: "intent_review",
        title: `Review ${payout.asset} transfer`,
        summary: `${payout.amount} ${payout.asset} to ${shortAddress(payout.recipient_address)}`,
        state: workflow.state,
        requested_at_ms: task.updated_at_ms,
      });
    }
    if (workflow.state === "authorized") {
      const payout = workflow.payouts[0];
      if (!payout) return null;
      return approval(task, now, {
        bot: "flow",
        kind: "wallet_signature",
        title: "Wallet signature required",
        summary: `Confirm ${payout.amount} ${payout.asset} in your mobile wallet`,
        state: workflow.state,
        requested_at_ms: workflow.approval?.decided_at_ms ?? task.updated_at_ms,
      });
    }
    if (workflow.state === "submitted" && workflow.submission) {
      return approval(task, now, {
        bot: "flow",
        kind: "receipt_verification",
        title: "Verify submitted transfer",
        summary: `Check receipt ${shortHash(workflow.submission.transaction_hash)}`,
        state: workflow.state,
        requested_at_ms: workflow.submission.submitted_at_ms,
      });
    }
  }

  if (task.bot === "commerce" && task.status.data.workflow.state === "awaiting_approval") {
    const workflow = task.status.data.workflow;
    return approval(task, now, {
      bot: "commerce",
      kind: "intent_review",
      title: "Review purchase intent",
      summary: `${workflow.selected_offer.name} · ${workflow.total_atomic} ${workflow.asset}`,
      state: workflow.state,
      requested_at_ms: task.updated_at_ms,
    });
  }

  if (task.bot === "operator" && task.status.data.workflow.state === "planned") {
    return approval(task, now, {
      bot: "operator",
      kind: "workflow_start",
      title: "Start coordinated workflow",
      summary: task.status.data.workflow.objective,
      state: task.status.data.workflow.state,
      requested_at_ms: task.updated_at_ms,
    });
  }

  return null;
}

export function pendingApprovals(tasks: Task[], now = Date.now()): PendingApproval[] {
  return tasks
    .map((task) => pendingApprovalForTask(task, now))
    .filter((value): value is PendingApproval => value !== null)
    .sort((left, right) => left.requested_at_ms - right.requested_at_ms);
}

function approval(
  task: Task,
  now: number,
  value: Omit<PendingApproval, "task_id" | "reminder_due">,
): PendingApproval {
  return {
    task_id: task.id,
    ...value,
    reminder_due: now - value.requested_at_ms >= APPROVAL_REMINDER_AFTER_MS,
  };
}

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function shortHash(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
