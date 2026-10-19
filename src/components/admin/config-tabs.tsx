"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Store, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/panel/configuracion", label: "Tienda", Icon: Store, key: "tienda" },
  { href: "/panel/configuracion/pagos", label: "Pagos", Icon: CreditCard, key: "pagos" },
  { href: "/panel/configuracion/entrega", label: "Entrega", Icon: Truck, key: "entrega" },
] as const;

/**
 * Las tres partes de Ajustes, cada una con lo que tiene configurado debajo
 * ("Pago móvil y Zelle", "Delivery $3 · retiro") para saber dónde entrar
 * sin abrir cada una. `warn` marca la que le falta algo para poder vender.
 */
export function ConfigTabs({
  summaries,
}: {
  summaries: Record<(typeof TABS)[number]["key"], { text: string; warn?: boolean }>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Partes de los ajustes" className="grid gap-2.5 sm:grid-cols-3">
      {TABS.map(({ href, label, Icon, key }) => {
        const active = pathname === href;
        const s = summaries[key];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-[14px] border bg-card px-3.5 py-3 transition-colors hover:border-[#C2CFDC]",
              active && "border-noche shadow-[inset_0_0_0_1px_hsl(var(--noche))] hover:border-noche",
            )}
          >
            <span
              className={cn(
                "grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[#EEF3F8] text-noche",
                active && "bg-noche text-white",
              )}
              aria-hidden="true"
            >
              <Icon className="size-[17px]" />
            </span>
            <span className="min-w-0">
              <b className="block text-[15px]">{label}</b>
              <span className={cn("block truncate text-[12.5px] text-ink-500", s.warn && "font-semibold text-[#92400E]")}>
                {s.text}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
