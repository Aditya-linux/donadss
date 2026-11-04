"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { submitTaskFeedback } from "@/lib/donads-api";

export function FeedbackControls({ taskId }: { taskId: string }) {
  const [rating, setRating] = useState<1 | 5 | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rate(nextRating: 1 | 5) {
    setSaving(true);
    setError(null);
    try {
      await submitTaskFeedback(taskId, nextRating);
      setRating(nextRating);
    } catch {
      setError("Could not save feedback. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2 sm:px-5">
      <div>
        <p className="text-xs font-medium">
          {rating ? "Feedback saved" : "Was this output useful?"}
        </p>
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void rate(5)}
          aria-label="Mark output useful"
          aria-pressed={rating === 5}
          className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:bg-muted"
        >
          <ThumbsUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void rate(1)}
          aria-label="Mark output not useful"
          aria-pressed={rating === 1}
          className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:bg-muted"
        >
          <ThumbsDown className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
