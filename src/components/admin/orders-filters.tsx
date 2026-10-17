"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { ORDER_STATUS_META } from "@/lib/constants";
import type { OrderStatus } from "@/types/database";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending_confirmation", label: ORDER_STATUS_META.pending_confirmation.label },
  { value: "pending_payment", label: ORDER_STATUS_META.pending_payment.label },
  { value: "confirmed", label: ORDER_STATUS_META.confirmed.label },
  { value: "preparing", label: ORDER_STATUS_META.preparing.label },
  { value: "in_delivery", label: ORDER_STATUS_META.in_delivery.label },
  { value: "completed", label: ORDER_STATUS_META.completed.label },
  { value: "cancelled", label: ORDER_STATUS_META.cancelled.label },
];

/**
 * Los estados como pestañas, con cuántos pedidos hay en cada uno. "Por
 * confirmar" lleva el número en amarillo: es plata que espera que alguien la
 * revise, lo único del panel que va en ese color.
 */
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
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  function apply(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === "all") sp.delete("status");
    else sp.set("status", value);
    // Cambiar de filtro vuelve a la primera página.
    sp.delete("ver");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <div
        role="group"
        aria-label="Filtrar por estado"
        className="inline-flex gap-1 rounded-xl border bg-card p-1 md:flex md:flex-wrap"
      >
        {FILTERS.map((f) => {
          const count = f.value === "all" ? total : counts[f.value as OrderStatus];
          const on = active === f.value;
          const urgent = f.value === "pending_confirmation" && Boolean(count);
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => apply(f.value)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[9px] px-3",
                "text-[13.5px] font-semibold transition-colors duration-150",
                on ? "bg-noche text-white" : "text-ink-600 hover:bg-ink-100 hover:text-foreground",
              )}
            >
              {f.label}
              {count ? (
                <span
                  className={cn(
                    "font-landing-mono text-xs font-medium tabular-nums",
                    urgent
                      ? cn("rounded-full px-1.5 py-px", on ? "bg-sol text-noche" : "bg-warning-surface text-warning-text")
                      : on
                        ? "text-niebla"
                        : "text-ink-500",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
