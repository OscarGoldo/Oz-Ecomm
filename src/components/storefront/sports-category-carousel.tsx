"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

/** Energetic, quick category carousel that filters instantly (?cat). */
export function SportsCategoryCarousel({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const active = params.get("cat") ?? "";

  function apply(slug: string) {
    const sp = new URLSearchParams(params.toString());
    if (slug) sp.set("cat", slug);
    else sp.delete("cat");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}#catalogo`));
  }

  function Pill({ value, children }: { value: string; children: React.ReactNode }) {
    const on = active === value;
    return (
      <button
        type="button"
        onClick={() => apply(value)}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-bold uppercase italic tracking-wide transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:border-primary",
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Pill value="">Todos</Pill>
      {categories.map((c) => (
        <Pill key={c.id} value={c.slug}>
          {c.name}
        </Pill>
      ))}
    </div>
  );
}
