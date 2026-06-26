"use client";

import { useEffect, useState } from "react";

/** A rolling urgency countdown (cycles every `cycleHours`) for the Drops hero. */
export function DropsCountdown({ cycleHours = 48 }: { cycleHours?: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const cycleMs = cycleHours * 3600 * 1000;
    const tick = () => {
      const now = Date.now();
      const next = Math.ceil(now / cycleMs) * cycleMs;
      setRemaining(next - now);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cycleHours]);

  const parts = splitTime(remaining);

  return (
    <div className="flex items-center gap-2">
      <Unit value={parts.h} label="HRS" />
      <Sep />
      <Unit value={parts.m} label="MIN" />
      <Sep />
      <Unit value={parts.s} label="SEG" />
    </div>
  );
}

function splitTime(ms: number | null) {
  if (ms === null) return { h: "--", m: "--", s: "--" };
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="min-w-[2.6rem] rounded-md bg-white/10 px-2 py-1.5 font-mono text-xl font-extrabold tabular-nums text-white sm:text-2xl"
        style={{ color: "hsl(var(--brand-accent, 0 0% 100%))" }}
      >
        {value}
      </div>
      <span className="mt-1 block text-[9px] font-bold tracking-widest text-white/50">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="pb-4 text-xl font-extrabold text-white/30">:</span>;
}
