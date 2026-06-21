"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function CategoryChips({
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
    if (!slug) sp.delete("cat");
    else sp.set("cat", slug);
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  }

  if (categories.length === 0) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={active === ""} onClick={() => apply("")}>
        Todos
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} active={active === c.slug} onClick={() => apply(c.slug)}>
          {c.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
