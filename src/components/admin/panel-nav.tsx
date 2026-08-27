"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Gift,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  Package,
  Palette,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tags,
  Ticket,
  Users,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Requiere plan Pro: se muestra con candado en el plan Gratis. */
  pro?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/panel/carritos", label: "Carritos", icon: ShoppingCart },
  { href: "/panel/productos", label: "Productos", icon: Package },
  { href: "/panel/categorias", label: "Categorías", icon: Tags },
  { href: "/panel/personalizar", label: "Diseño", icon: Palette },
  { href: "/panel/descuentos", label: "Descuentos", icon: Ticket, pro: true },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/analitica", label: "Analítica", icon: BarChart3, pro: true },
  { href: "/panel/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/panel/referidos", label: "Referidos", icon: Gift },
  { href: "/panel/plan", label: "Plan", icon: Sparkles },
  { href: "/panel/configuracion", label: "Ajustes", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavProps {
  /** Badge counts keyed by href (e.g. unattended orders on /panel/pedidos). */
  badges?: Record<string, number>;
  /** Plan Pro vigente: sin él, los ítems `pro` van con candado. */
  pro?: boolean;
}

/** Desktop sidebar navigation (md and up). */
export function PanelSidebarNav({ badges = {}, pro = false }: NavProps) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.href];
        const locked = Boolean(item.pro) && !pro;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            {locked && (
              <Lock
                className={cn(
                  "size-3",
                  active ? "text-primary/70" : "text-muted-foreground/60",
                )}
              />
            )}
            {badge ? (
              <span
                className={cn(
                  "ml-auto grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5",
                  active
                    ? "bg-primary text-primary-foreground"
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

/** Los cuatro destinos de la barra inferior en móvil. El resto vive en "Más". */
const PRIMARY_HREFS = ["/panel", "/panel/pedidos", "/panel/productos"];

/** Mobile bottom tab bar (below md): 3 destinos fijos + "Más". */
export function PanelBottomNav({ badges = {}, pro = false }: NavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const primary = NAV_ITEMS.filter((i) => PRIMARY_HREFS.includes(i.href));
  const rest = NAV_ITEMS.filter((i) => !PRIMARY_HREFS.includes(i.href));

  // Cualquier pendiente que viva dentro de "Más" tiene que verse desde afuera:
  // si no, el dueño no tiene forma de saber que hay algo esperándolo ahí.
  const restBadge = rest.reduce((sum, i) => sum + (badges[i.href] ?? 0), 0);
  const restActive = rest.some((i) => isActive(pathname, i.href));

  // El menú abierto bloquea el scroll del fondo y cierra con Escape.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // Al navegar, el menú se cierra solo.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Hoja "Más" */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 md:hidden",
          sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        aria-hidden={!sheetOpen}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="grid grid-cols-3 gap-1 p-3">
          {rest.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badges[item.href];
            const locked = Boolean(item.pro) && !pro;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" />
                  {locked && (
                    <span className="absolute -right-2 -top-1 grid size-3.5 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Lock className="size-2" />
                    </span>
                  )}
                  {badge ? (
                    <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-warning px-1 text-3xs font-bold leading-4 text-warning-foreground">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Barra fija. Fondo opaco: antes era bg-background/25 con backdrop-blur,
          y en los Android donde backdrop-filter no aplica quedaba el contenido
          de la página pasando por detrás de las etiquetas. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación principal"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = badges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2 text-2xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className="size-5" />
                {badge ? (
                  <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-warning px-1 text-3xs font-bold leading-4 text-warning-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </span>
              {item.label}
              <span
                className={cn(
                  "absolute bottom-0 h-0.5 w-6 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden="true"
              />
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setSheetOpen((o) => !o)}
          aria-expanded={sheetOpen}
          className={cn(
            "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2 text-2xs font-medium transition-colors",
            sheetOpen || restActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span className="relative">
            <MoreHorizontal className="size-5" />
            {restBadge > 0 && !sheetOpen ? (
              <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-warning px-1 text-3xs font-bold leading-4 text-warning-foreground">
                {restBadge > 9 ? "9+" : restBadge}
              </span>
            ) : null}
          </span>
          Más
        </button>
      </nav>
    </>
  );
}
