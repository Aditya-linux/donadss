export type ReadinessGate = {
  id: string;
  title: string;
  passed: boolean;
  evidence: string;
};

export function mainnetReadiness(verifiedTestnetReceipts: number): { ready: false; network_enabled: false; gates: ReadinessGate[] } {
  const gates: ReadinessGate[] = [
    { id: "testnet-receipts", title: "Ten independently verified Testnet receipts", passed: verifiedTestnetReceipts >= 10, evidence: `${verifiedTestnetReceipts}/10 persisted receipts` },
    { id: "contract-addresses", title: "Verified mainnet contract addresses", passed: false, evidence: "Mainnet deployment intentionally not performed" },
    { id: "external-review", title: "Independent security review completed", passed: Boolean(process.env.DONADS_SECURITY_REVIEW_ARTIFACT?.trim()), evidence: process.env.DONADS_SECURITY_REVIEW_ARTIFACT?.trim() || "Artifact not configured" },
    { id: "signer-custody", title: "KMS/HSM session signer and rotation runbook", passed: Boolean(process.env.DONADS_SIGNER_KEY_REFERENCE?.trim() && process.env.DONADS_SIGNER_RUNBOOK_URL?.trim()), evidence: "Server-side references only" },
    { id: "monitoring", title: "Production alerts and incident runbook", passed: Boolean(process.env.DONADS_INCIDENT_RUNBOOK_URL?.trim()), evidence: process.env.DONADS_INCIDENT_RUNBOOK_URL?.trim() || "Runbook not configured" },
    { id: "kill-switch", title: "Multisig pause and revocation drill", passed: false, evidence: "Mainnet drill not completed" },
  ];
  return { ready: false, network_enabled: false, gates };
}
