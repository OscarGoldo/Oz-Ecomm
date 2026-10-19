import Link from "next/link";
import { Check } from "lucide-react";

import type { SetupItem } from "@/lib/store-setup";

/** "Tu tienda, lista para vender": lo que está y lo que falta, con su enlace. */
export function SetupChecklist({ items }: { items: SetupItem[] }) {
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / Math.max(1, items.length)) * 100);
  return (
    <section aria-labelledby="lista-vender" className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 id="lista-vender" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Tu tienda, lista para vender
        </h2>
        <span className="font-landing-mono text-[12.5px] font-semibold tabular-nums">
          {done} de {items.length}
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#EEF3F8]" aria-hidden="true">
        <span className="block h-full rounded-r-[4px] bg-[#16A34A]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2.5 border-t border-[#EEF3F8] py-2 text-[13.5px] first:border-t-0">
            {i.done ? (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#16A34A] text-white" aria-hidden="true">
                <Check className="size-3" strokeWidth={3.4} />
              </span>
            ) : (
              <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-[#C2CFDC]" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              {i.label}
              <span className="sr-only">{i.done ? ": listo" : ": falta"}</span>
            </span>
            {!i.done && (
              <Link href={i.href} className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">
                {i.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
