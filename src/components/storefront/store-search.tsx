"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** Prominent storefront search that updates ?q (debounced) and scrolls to results. */
export function StoreSearch({
  placeholder = "Buscar productos…",
  big = false,
}: {
  placeholder?: string;
  big?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q) sp.set("q", q);
      else sp.delete("q");
      startTransition(() => router.replace(`${pathname}?${sp.toString()}#catalogo`));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <Search
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground",
          big ? "size-5" : "size-4",
        )}
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-input bg-background pl-11 pr-4 text-foreground outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring",
          big ? "h-14 text-base" : "h-11 text-sm",
        )}
      />
    </div>
  );
}
