import { cn } from "@/lib/utils";
import { formatBs } from "@/lib/format";
import type { RateSource } from "@/types/database";

interface RatesStripProps {
  bcv: number | null;
  paralelo: number | null;
  usdt: number | null;
  active: RateSource;
}

/** Compact reference of the 3 common VE exchange rates for the dashboard. */
export function RatesStrip({ bcv, paralelo, usdt, active }: RatesStripProps) {
  const rates: { id: RateSource | "paralelo"; label: string; value: number | null }[] = [
    { id: "bcv", label: "BCV", value: bcv },
    { id: "paralelo", label: "Paralelo", value: paralelo },
    { id: "usdt", label: "USDT", value: usdt },
  ];

  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground">
          Tasas de cambio (Bs por USD)
        </h2>
        <span className="text-[11px] text-muted-foreground">Referencia del día</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rates.map((r) => {
          const isActive = r.id === active;
          return (
            <div
              key={r.id}
              className={cn(
                "rounded-lg border p-2.5",
                isActive ? "border-primary/50 bg-primary/5" : "bg-background",
              )}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {r.label}
                </p>
                {isActive && (
                  <span className="rounded-full bg-primary/15 px-1.5 text-[9px] font-semibold text-primary">
                    en uso
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-bold tracking-tight">
                {r.value ? formatBs(r.value) : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
