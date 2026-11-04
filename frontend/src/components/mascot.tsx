"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const MASCOT_LOGO = "/brand/donads-mascot.jpeg";
const MASCOT_MOTION_SHEET = "/brand/donads-process-storyboard.jpeg";

const MASCOT_TIMING = {
  frameMs: 140,
  frameCount: 9,
} as const;

const POSES = [
  { column: 0, row: 0 },
  { column: 1, row: 0 },
  { column: 2, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 1 },
  { column: 2, row: 1 },
  { column: 0, row: 2 },
  { column: 1, row: 2 },
  { column: 2, row: 2 },
] as const;

export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src={MASCOT_LOGO}
        alt="DONADS robot mascot"
        width={size}
        height={size}
        priority
        sizes={`${size}px`}
        className="size-full object-cover"
      />
    </div>
  );
}

export function MascotMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src={MASCOT_LOGO}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      sizes={`${size}px`}
      className="rounded-lg object-cover"
    />
  );
}

/*
  Mascot loading storyboard (absolute time from loop start)
     0ms  idle
   140ms  look around
   280ms  prepare
   420ms  jump
   560ms  mid-air
   700ms  spin
   840ms  processing
   980ms  almost there
  1120ms  back to idle
*/
export function MascotLoader({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const timer = window.setInterval(
      () => setStage((current) => (current + 1) % MASCOT_TIMING.frameCount),
      MASCOT_TIMING.frameMs,
    );
    return () => window.clearInterval(timer);
  }, []);

  const pose = POSES[stage];
  const frameWidth = compact ? 72 : 112;
  const frameHeight = Math.round(frameWidth * 0.86);
  const rowOffset = [-1.03, -2.14, -3.26][pose.row] * frameWidth;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex items-center rounded-xl border border-border bg-card ${compact ? "gap-3 p-3" : "flex-col gap-4 p-5 text-center"}`}
    >
      <div
        aria-hidden="true"
        className="shrink-0 overflow-hidden rounded-xl"
        style={{
          width: frameWidth,
          height: frameHeight,
          backgroundImage: `url(${MASCOT_MOTION_SHEET})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${frameWidth * 3}px auto`,
          backgroundPosition: `${-pose.column * frameWidth}px ${rowOffset}px`,
        }}
      />
      <div className={compact ? "min-w-0 flex-1" : "w-full max-w-xs"}>
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary motion-safe:animate-pulse motion-reduce:w-1/3" />
        </div>
      </div>
    </div>
  );
}
