"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/panel/configuracion", label: "Tienda" },
  { href: "/panel/configuracion/pagos", label: "Pagos" },
  { href: "/panel/configuracion/entrega", label: "Entrega" },
];

export function ConfigTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
