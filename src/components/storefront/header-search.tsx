"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** Search input tone, matching the header variant it sits on. */
export type SearchTone = "brand" | "light" | "dark";

const INPUT_TONES: Record<SearchTone, string> = {
  // On a colored brand bar → solid white pill (original look).
  brand:
    "bg-white text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/70",
  // On a light header → soft gray pill.
  light:
    "border-border bg-muted/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40",
  // On a dark header → translucent white pill.
  dark: "bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/40",
};

const ICON_TONES: Record<SearchTone, string> = {
  brand: "text-muted-foreground",
  light: "text-muted-foreground",
  dark: "text-white/50",
};

export function HeaderSearch({
  storeSlug,
  tone = "brand",
}: {
  storeSlug: string;
  tone?: SearchTone;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/${storeSlug}?q=${encodeURIComponent(term)}` : `/${storeSlug}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <Search
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
          ICON_TONES[tone],
        )}
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Buscar productos…"
        className={cn(
          "h-10 w-full rounded-full border border-transparent pl-9 pr-4 text-sm outline-none ring-offset-2",
          INPUT_TONES[tone],
        )}
      />
    </form>
  );
}
