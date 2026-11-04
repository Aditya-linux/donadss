"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Radar,
  Send,
} from "lucide-react";
import { FormEvent, useRef, useState } from "react";

import { FeedbackControls } from "@/components/feedback-controls";
import { Mascot, MascotLoader } from "@/components/mascot";
import {
  ApiError,
  ScoutCompletedTask,
  createScoutTask,
  waitForTask,
} from "@/lib/donads-api";

type Item =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; task: ScoutCompletedTask };

const suggestions = [
  "Summarize https://docs.monad.xyz and focus on architecture",
  "Research the latest details on https://www.monad.xyz",
];

function ResearchReport({ task }: { task: ScoutCompletedTask }) {
  const { report, agent_version: version } = task.status.data;
  const fetched = report.sources.filter((source) => source.status === "fetched");
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {[
          ["Sources", `${fetched.length}/${report.sources.length}`],
          ["Findings", report.findings.length],
          ["Research time", `${task.status.latency_ms} ms`],
        ].map(([label, value]) => (
          <div key={label} className="bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <section className="p-4 sm:p-5" aria-labelledby={`report-${task.id}`}>
        <h2 id={`report-${task.id}`} className="text-base font-semibold">{report.title}</h2>
        {report.findings.length ? (
          <ol className="mt-4 space-y-4">
            {report.findings.map((finding, index) => (
              <li key={`${finding.text}-${index}`} className="text-sm leading-6">
                <span>{finding.text}</span>{" "}
                {finding.citations.map((citation) => {
                  const source = report.sources.find((item) => item.id === citation);
                  return source?.status === "fetched" ? (
                    <a
                      key={citation}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`Open source ${citation}: ${source.title}`}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md font-mono text-xs font-semibold text-primary underline decoration-border underline-offset-4 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      [{citation}]
                    </a>
                  ) : null;
                })}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No sufficiently clear statements were extracted. Review the sources directly.
          </p>
        )}
      </section>
      <section className="border-t border-border p-4 sm:p-5" aria-label="Sources">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" aria-hidden="true" /> Sources
        </h3>
        <ul className="mt-3 space-y-2">
          {report.sources.map((source) => (
            <li key={source.id} className="flex min-h-10 items-start gap-3 text-sm">
              {source.status === "fetched" ? (
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-1 size-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <div className="min-w-0">
                {source.status === "fetched" ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-10 items-center gap-1.5 font-medium underline decoration-border underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="break-words">[{source.id}] {source.title}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <>
                    <p className="font-medium">[{source.id}] Source unavailable</p>
                    <p className="mt-1 text-xs text-muted-foreground">{source.error}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <div className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
        <p>{report.limitations}</p>
        <p className="mt-1 font-mono">{version}</p>
      </div>
      <FeedbackControls taskId={task.id} />
    </div>
  );
}

export function ScoutWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("Scout is preparing the research task.");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submitPrompt(text: string) {
    if (working || !text.trim()) return;
    const normalized = text.trim();
    setError(null);
    setWorking(true);
    setProgress("Scout is preparing the research task.");
    try {
      const task = await createScoutTask(normalized);
      setItems((current) => [...current, { id: `user-${task.id}`, role: "user", text: normalized }]);
      const completed = await waitForTask(task.id, (update) => {
        const latest = update.events.at(-1);
        if (latest) setProgress(latest.message);
      });
      if (completed.bot !== "scout") throw new ApiError("Scout returned an unexpected result.");
      setItems((current) => [...current, { id: `assistant-${completed.id}`, role: "assistant", task: completed }]);
      setPrompt("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not reach Scout. Start the DONADS API and try again.");
    } finally {
      setWorking(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(prompt);
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col bg-brand-bg">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-48 pt-8 sm:px-6" aria-live="polite">
        {items.length === 0 ? (
          <section className="my-auto flex flex-col items-center py-12 text-center">
            <Mascot />
            <h1 className="mt-7 max-w-xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Research with receipts.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
              Give Scout a question and up to five public URLs. It returns a concise report with a source on every finding.
            </p>
            <div className="mt-8 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:justify-center">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setPrompt(suggestion); inputRef.current?.focus(); }}
                  className="min-h-11 rounded-xl border border-border bg-card px-4 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:text-center"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-8 py-4">
            {items.map((item) => item.role === "user" ? (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">{item.text}</div>
              </div>
            ) : (
              <article key={item.id} className="flex gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Radar className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm leading-6">{item.task.status.summary}</p><ResearchReport task={item.task} /></div>
              </article>
            ))}
            {working ? (
              <MascotLoader label={progress} />
            ) : null}
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 lg:left-72">
        <form onSubmit={onSubmit} className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-lg shadow-foreground/5">
          <label htmlFor="scout-prompt" className="block px-3 pt-2 text-xs font-medium">Message Scout</label>
          <textarea
            ref={inputRef}
            id="scout-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
            rows={2}
            autoComplete="off"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "scout-error" : "scout-help"}
            placeholder="Ask a question and include public source URLs…"
            className="max-h-40 min-h-16 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-1">
            <p id="scout-help" className="truncate px-2 text-xs text-muted-foreground">Up to 5 URLs · no wallet required</p>
            <button type="submit" disabled={working || !prompt.trim()} aria-busy={working} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label={working ? "Researching" : "Send message"}><Send className="size-4" aria-hidden="true" /></button>
          </div>
        </form>
        {error ? (
          <div id="scout-error" role="alert" className="mx-auto mt-2 flex max-w-3xl items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm"><span>{error}</span><button type="button" onClick={() => setError(null)} className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button></div>
        ) : null}
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">Source-linked summaries can still be incomplete. Verify before acting.</p>
      </div>
    </main>
  );
}
