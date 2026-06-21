"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { OrderStatus } from "@/types/database";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending_confirmation", label: ORDER_STATUS_META.pending_confirmation.label },
  { value: "confirmed", label: ORDER_STATUS_META.confirmed.label },
  { value: "preparing", label: ORDER_STATUS_META.preparing.label },
  { value: "in_delivery", label: ORDER_STATUS_META.in_delivery.label },
  { value: "completed", label: ORDER_STATUS_META.completed.label },
  { value: "cancelled", label: ORDER_STATUS_META.cancelled.label },
];

export function OrdersFilters({
  counts,
}: {
  counts: Partial<Record<OrderStatus, number>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const active = params.get("status") ?? "all";

  function apply(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === "all") sp.delete("status");
    else sp.set("status", value);
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((f) => {
        const count = f.value === "all" ? undefined : counts[f.value as OrderStatus];
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => apply(f.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {count ? ` (${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
