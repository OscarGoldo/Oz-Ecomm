import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Las pestañas de Finanzas. Antes todo vivía en una sola página larga
 * (resumen, gastos, nómina, pagos de Tiendify y últimas ventas, uno debajo
 * del otro); ahora el resumen va primero y lo que se carga a mano tiene su
 * propia pantalla.
 */
const TABS = [
  { id: "resumen", href: "/panel/finanzas", label: "Resumen" },
  { id: "gastos", href: "/panel/finanzas/gastos", label: "Gastos" },
  { id: "nomina", href: "/panel/finanzas/nomina", label: "Nómina" },
  { id: "cobros", href: "/panel/finanzas/cobros", label: "Cobros de Tiendify" },
  { id: "reportes", href: "/panel/finanzas/reportes", label: "Reportes" },
] as const;

export type FinanceTab = (typeof TABS)[number]["id"];

export function FinanceTabs({ active }: { active: FinanceTab }) {
  return (
    <nav
      aria-label="Secciones de finanzas"
      className="-mx-4 flex gap-6 overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0 print:hidden [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-sm font-semibold transition-colors duration-150",
              on ? "border-foreground text-foreground" : "border-transparent text-ink-500 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** El encabezado de cada pestaña: el mismo tamaño y voz en todas. */
export function FinanceHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div className="min-w-0">
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">{title}</h1>
        <p className="mt-1.5 text-[15px] text-ink-600">{sub}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
