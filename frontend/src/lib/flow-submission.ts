const PREFIX = "donads_flow_submission:";
const HASH = /^0x[0-9a-f]{64}$/i;

export function readPendingFlowHash(taskId: string): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(`${PREFIX}${taskId}`);
  return value && HASH.test(value) ? value.toLowerCase() : null;
}

export function rememberPendingFlowHash(taskId: string, transactionHash: string): void {
  if (!HASH.test(transactionHash)) throw new Error("Wallet returned an invalid transaction hash.");
  window.localStorage.setItem(`${PREFIX}${taskId}`, transactionHash.toLowerCase());
}

export function forgetPendingFlowHash(taskId: string): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(`${PREFIX}${taskId}`);
}
