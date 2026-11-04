"use client";

import {
  CalendarDays,
  CheckCircle2,
  Megaphone,
  Send,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { FeedbackControls } from "@/components/feedback-controls";
import { Mascot, MascotLoader } from "@/components/mascot";
import {
  ApiError,
  BrandProfile,
  GrowthCompletedTask,
  createGrowthTask,
  getBrandProfile,
  saveBrandProfile,
  waitForTask,
} from "@/lib/donads-api";

type Platform = "x" | "linkedin" | "community" | "email";

const platformOptions: Array<{ id: Platform; label: string }> = [
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "community", label: "Community" },
  { id: "email", label: "Email" },
];

const initialProfile: BrandProfile = {
  id: "new-project",
  project_name: "",
  product_description: "",
  target_audience: "",
  preferred_tone: "precise and playful",
  terminology: [],
  value_propositions: [],
  approved_links: [],
  prohibited_terms: [],
  previous_approved_examples: [],
  version: 0,
  updated_at_ms: 0,
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "new-project"
  );
}

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function CampaignReport({ task }: { task: GrowthCompletedTask }) {
  const { campaign, agent_version: version } = task.status.data;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {[
          ["Drafts", campaign.calendar.length],
          ["Assets", campaign.required_asset_count],
          ["Build time", `${task.status.latency_ms} ms`],
        ].map(([label, value]) => (
          <div key={label} className="bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <section className="p-4 sm:p-5" aria-labelledby={`campaign-${task.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`campaign-${task.id}`} className="text-base font-semibold">
              {campaign.project_name} campaign
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.objective}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">Draft only</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {campaign.message_pillars.map((pillar) => (
            <span key={pillar} className="rounded-full border border-border px-3 py-1 text-xs">
              {pillar}
            </span>
          ))}
        </div>
      </section>
      <ol className="divide-y divide-border" aria-label="Content calendar">
        {campaign.calendar.map((day) => (
          <li key={`${day.day}-${day.platform}`} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-muted font-mono text-xs font-semibold">{day.day}</span>
                <div>
                  <p className="text-sm font-medium">{day.date} · {day.platform}</p>
                  <p className="text-xs text-muted-foreground">{day.format} · {day.objective}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Draft
              </span>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted p-4 font-sans text-sm leading-6">{day.draft}</pre>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p><span className="font-medium text-foreground">CTA:</span> {day.call_to_action}</p>
              <p><span className="font-medium text-foreground">Visual:</span> {day.visual_asset}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
        <p>Publishing and external messaging are disabled. Review every draft before use.</p>
        <p className="mt-1 font-mono">{version}</p>
      </div>
      <FeedbackControls taskId={task.id} />
    </div>
  );
}

function BrandForm({
  profile,
  onChange,
  platforms,
  onPlatformsChange,
  duration,
  onDurationChange,
  startDate,
  onStartDateChange,
}: {
  profile: BrandProfile;
  onChange: (profile: BrandProfile) => void;
  platforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  duration: number;
  onDurationChange: (duration: number) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
}) {
  const valueText = profile.value_propositions.join("\n");
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6" aria-labelledby="growth-brief-title">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" aria-hidden="true" /></span>
          <div><h1 id="growth-brief-title" className="text-base font-semibold">Campaign brief</h1><p className="mt-1 text-xs leading-5 text-muted-foreground">Saved as reusable brand memory when the campaign is created.</p></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            <span>Project name</span>
            <input required value={profile.project_name} onChange={(event) => onChange({ ...profile, project_name: event.target.value })} autoComplete="organization" className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Target audience</span>
            <input required value={profile.target_audience} onChange={(event) => onChange({ ...profile, target_audience: event.target.value })} autoComplete="off" className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
            <span>Product description</span>
            <textarea required rows={2} value={profile.product_description} onChange={(event) => onChange({ ...profile, product_description: event.target.value })} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-normal leading-6 focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
            <span>Value propositions <span className="font-normal text-muted-foreground">· one per line</span></span>
            <textarea required rows={2} value={valueText} onChange={(event) => onChange({ ...profile, value_propositions: event.target.value.split("\n") })} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-normal leading-6 focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Tone</span>
            <select value={profile.preferred_tone} onChange={(event) => onChange({ ...profile, preferred_tone: event.target.value })} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring">
              <option>precise and playful</option><option>technical and direct</option><option>professional</option><option>educational</option><option>community-first</option><option>bold</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Approved link <span className="font-normal text-muted-foreground">· optional</span></span>
            <input type="url" inputMode="url" value={profile.approved_links[0] ?? ""} onChange={(event) => onChange({ ...profile, approved_links: event.target.value ? [event.target.value] : [] })} autoComplete="url" placeholder="https://example.com" className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Start date</span>
            <input type="date" required value={startDate} onChange={(event) => onStartDateChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Campaign length</span>
            <select value={duration} onChange={(event) => onDurationChange(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 font-normal focus-visible:ring-2 focus-visible:ring-ring">
              <option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
            </select>
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Platforms</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {platformOptions.map((option) => (
              <label key={option.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                <input type="checkbox" checked={platforms.includes(option.id)} onChange={(event) => onPlatformsChange(event.target.checked ? [...platforms, option.id] : platforms.filter((item) => item !== option.id))} className="size-4 accent-current" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

export function GrowthWorkspace() {
  const [profile, setProfile] = useState(initialProfile);
  const [platforms, setPlatforms] = useState<Platform[]>(["x", "linkedin"]);
  const [duration, setDuration] = useState(7);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [objective, setObjective] = useState("");
  const [result, setResult] = useState<GrowthCompletedTask | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("Growth is preparing the campaign.");
  const [error, setError] = useState<string | null>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const savedId = window.localStorage.getItem("donads-growth-profile");
    if (!savedId) return;
    const controller = new AbortController();
    void getBrandProfile(savedId, controller.signal)
      .then((saved) => setProfile(saved))
      .catch(() => window.localStorage.removeItem("donads-growth-profile"));
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = splitList(profile.value_propositions.join("\n"));
    if (!profile.project_name.trim() || !profile.product_description.trim() || !profile.target_audience.trim() || values.length === 0) {
      setError("Complete the project name, description, audience, and at least one value proposition.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one platform.");
      return;
    }
    if (!objective.trim()) {
      setError("Describe the campaign objective.");
      objectiveRef.current?.focus();
      return;
    }
    setWorking(true);
    setError(null);
    setProgress("Saving the brand profile.");
    try {
      const saved = await saveBrandProfile({ ...profile, id: slugify(profile.project_name), value_propositions: values });
      setProfile(saved);
      window.localStorage.setItem("donads-growth-profile", saved.id);
      setProgress("Growth is preparing the campaign.");
      const task = await createGrowthTask({ objective: objective.trim(), start_date: startDate, duration_days: duration, platforms, profile: saved });
      const completed = await waitForTask(task.id, (update) => {
        const latest = update.events.at(-1);
        if (latest) setProgress(latest.message);
      });
      if (completed.bot !== "growth") throw new ApiError("Growth returned an unexpected result.");
      setResult(completed);
      setShowProfile(false);
      setObjective("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not reach Growth. Start the DONADS API and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col bg-brand-bg">
      <form onSubmit={submit} className="flex flex-1 flex-col" aria-live="polite">
        {showProfile ? (
          <BrandForm profile={profile} onChange={setProfile} platforms={platforms} onPlatformsChange={setPlatforms} duration={duration} onDurationChange={setDuration} startDate={startDate} onStartDateChange={setStartDate} />
        ) : null}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-48 pt-8 sm:px-6">
          {!result && !showProfile ? (
            <section className="my-auto flex flex-col items-center py-12 text-center"><Mascot /><h1 className="mt-7 font-serif text-4xl tracking-tight sm:text-5xl">Campaigns, ready for review.</h1></section>
          ) : result ? (
            <article className="flex gap-3 py-4">
              <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Megaphone className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm leading-6">{result.status.summary}</p><CampaignReport task={result} /></div>
            </article>
          ) : (
            <div className="flex items-center justify-center py-8 text-center text-sm text-muted-foreground"><CalendarDays className="mr-2 size-4" aria-hidden="true" /> Complete the brief, then describe the campaign objective below.</div>
          )}
          {working ? (
            <div className="mt-4"><MascotLoader label={progress} compact /></div>
          ) : null}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 lg:left-72">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-lg shadow-foreground/5">
            <label htmlFor="growth-objective" className="block px-3 pt-2 text-xs font-medium">Campaign objective</label>
            <textarea ref={objectiveRef} id="growth-objective" value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} autoComplete="off" aria-invalid={error ? "true" : undefined} aria-describedby={error ? "growth-error" : "growth-help"} placeholder="Describe the campaign objective…" className="max-h-40 min-h-16 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
            <div className="flex items-center justify-between gap-2 px-1">
              <button type="button" onClick={() => setShowProfile((current) => !current)} className="min-h-10 rounded-lg px-2 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{showProfile ? "Hide brief" : "Edit brief"}</button>
              <button type="submit" disabled={working || !objective.trim()} aria-busy={working} aria-label={working ? "Creating campaign" : "Create campaign"} className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"><Send className="size-4" aria-hidden="true" /></button>
            </div>
          </div>
          {error ? (
            <div id="growth-error" role="alert" className="mx-auto mt-2 flex max-w-3xl items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm"><span>{error}</span><button type="button" onClick={() => setError(null)} className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button></div>
          ) : null}
          <p id="growth-help" className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">Draft only · publishing and messaging disabled</p>
        </div>
      </form>
    </main>
  );
}
