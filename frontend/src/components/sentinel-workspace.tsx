"use client";

import { ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import { MascotLoader } from "@/components/mascot";
import { ReportDownloadButton } from "@/components/report-download-button";
import { createSentinelTask, SentinelCompletedTask, waitForTask } from "@/lib/donads-api";

type Report = {
  summary: string;
  score: number;
  bytes: number;
  findings: Array<{
    id: string;
    severity: string;
    title: string;
    evidence: string;
  }>;
};

export function SentinelWorkspace() {
  const [bytecode, setBytecode] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [task, setTask] = useState<SentinelCompletedTask | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const created = await createSentinelTask(bytecode);
      const task = await waitForTask(created.id);
      if (task.status.state !== "completed" || task.bot !== "sentinel") {
        throw new Error("Sentinel did not complete the scan.");
      }
      const data = task.status.data as {
        threat_score: number;
        bytecode_bytes: number;
        findings: Report["findings"];
      };
      setReport({
        summary: task.status.summary,
        score: data.threat_score,
        bytes: data.bytecode_bytes,
        findings: data.findings,
      });
      setTask(task);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sentinel failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-8">
      {working ? <MascotLoader label="Scanning executable bytecode…" /> : null}
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-7" aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Sentinel bytecode triage</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect executable EVM opcodes locally. This is a deterministic first-pass signal, not a complete smart-contract audit.
          </p>
        </header>
        <form onSubmit={submit} aria-busy={working} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <label className="block text-sm font-medium">
            Contract bytecode
            <textarea
              required
              rows={8}
              value={bytecode}
              onChange={(event) => setBytecode(event.target.value)}
              placeholder="0x60806040…"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button disabled={working} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40">
            {working ? "Scanning…" : "Scan bytecode"}
          </button>
        </form>
        {report ? (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Threat score</p>
                <p className="text-4xl font-semibold">{report.score}<span className="text-base text-muted-foreground">/100</span></p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{report.bytes} bytes</p>
            </div>
            <p className="text-sm">{report.summary}</p>
            {report.findings.length ? report.findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wider">{finding.severity}</p>
                <p className="mt-1 font-medium">{finding.title}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{finding.evidence}</p>
              </div>
            )) : <p className="rounded-xl bg-muted p-4 text-sm">No high-confidence opcode signals found.</p>}
          </section>
        ) : null}
        {task ? <ReportDownloadButton task={task} /> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  );
}
