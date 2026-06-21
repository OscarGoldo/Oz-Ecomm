"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tags,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/panel/productos", label: "Productos", icon: Package },
  { href: "/panel/categorias", label: "Categorías", icon: Tags },
  { href: "/panel/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/panel/configuracion", label: "Ajustes", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavProps {
  /** Badge counts keyed by href (e.g. unattended orders on /panel/pedidos). */
  badges?: Record<string, number>;
}

/** Desktop sidebar navigation (md and up). */
export function PanelSidebarNav({ badges = {} }: NavProps) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            {badge ? (
              <span
                className={cn(
                  "ml-auto grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5",
                  active
                    ? "bg-primary-foreground text-primary"
                    : "bg-warning text-warning-foreground",
                )}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar (below md). */
export function PanelBottomNav({ badges = {} }: NavProps) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background md:hidden"
      style={{
        gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <item.icon className="size-5" />
              {badge ? (
                <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-bold leading-4 text-warning-foreground">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
