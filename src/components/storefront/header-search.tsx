"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function HeaderSearch({ storeSlug }: { storeSlug: string }) {
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
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Buscar productos…"
        className="h-10 w-full rounded-full border border-transparent bg-white pl-9 pr-4 text-sm text-foreground shadow-sm outline-none ring-offset-2 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/70"
      />
    </form>
  );
}
