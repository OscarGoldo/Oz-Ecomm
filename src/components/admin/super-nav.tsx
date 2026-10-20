"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Gift,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Presentation,
  Receipt,
  Store,
  Ticket,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  /** Rótulo de la sección. `null` = grupo sin encabezado (va primero). */
  label: string | null;
  items: NavItem[];
}

/**
 * El menú del super admin, agrupado por la pregunta que se viene a responder:
 * quiénes son los clientes, cómo va la plata, qué trae tiendas nuevas. Es el
 * mismo patrón que el del comerciante (panel-nav.tsx) a propósito: quien
 * maneja Tiendify ya conoce ese panel de memoria.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/super", label: "Inicio", icon: LayoutDashboard }],
  },
  {
    label: "Clientes",
    items: [
      { href: "/super/tiendas", label: "Tiendas", icon: Store },
      { href: "/super/comentarios", label: "Comentarios", icon: MessageSquare },
    ],
  },
  {
    label: "Dinero",
    items: [
      { href: "/super/suscripciones", label: "Suscripciones", icon: Receipt },
      { href: "/super/pagos", label: "Pagos a tiendas", icon: Wallet },
      { href: "/super/stripe", label: "Stripe", icon: CreditCard },
      { href: "/super/credito", label: "Crédito", icon: HandCoins },
    ],
  },
  {
    label: "Crecimiento",
    items: [
      { href: "/super/ejemplos", label: "Páginas ejemplo", icon: Presentation },
      { href: "/super/codigos", label: "Códigos", icon: Ticket },
      { href: "/super/referidos", label: "Referidos", icon: Gift },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  if (href === "/super") return pathname === "/super";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavProps {
  /** Pendientes por sección, por href (comprobantes, referidos, comentarios). */
  badges?: Record<string, number>;
}

/**
 * El numerito de pendientes. En el teléfono se monta sobre la esquina del
 * ícono, así que es más chico y redondo para no taparlo. Va en amarillo sol:
 * es lo que espera por un socio.
 */
function Badge({ count, onIcon = false }: { count: number; onIcon?: boolean }) {
  const max = onIcon ? 9 : 99;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-sol px-1 text-3xs font-bold tabular-nums text-noche",
        onIcon
          ? "absolute -right-2 -top-1.5 min-w-4 rounded-full leading-4"
          : "ml-auto min-w-[1.125rem] rounded leading-[1.125rem]",
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

/** Los comprobantes son plata esperando: su número va en sol, el resto no. */
const URGENT_BADGE_HREF = "/super/suscripciones";

/**
 * Menú lateral (md en adelante), sobre la barra noche: el mismo trato que el
 * del panel del comerciante (panel-nav.tsx).
 */
export function SuperSidebarNav({ badges = {} }: NavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del super admin" className="flex flex-col">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? "root"} className={cn(i > 0 && "mt-3.5")}>
          {group.label && (
            <p className="mb-1 px-2.5 font-landing-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7F93A8]">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[34px] items-center gap-2.5 rounded-[9px] px-2.5",
                    "text-sm font-medium",
                    "transition-colors duration-150 ease-out",
                    active
                      ? "bg-white/[0.11] text-white"
                      : "text-white/[0.72] hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-[1.0625rem] shrink-0 transition-colors",
                      active ? "text-brand-400" : "text-white/50 group-hover:text-white/80",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "ml-auto grid h-5 min-w-[1.375rem] shrink-0 place-items-center rounded-full px-1.5",
                        "font-landing-mono text-[11.5px] font-semibold tabular-nums",
                        item.href === URGENT_BADGE_HREF
                          ? "bg-sol text-noche"
                          : "bg-white/[0.14] text-white",
                      )}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Los destinos fijos de la barra inferior en móvil. El resto vive en "Más". */
const PRIMARY_HREFS = ["/super", "/super/tiendas", "/super/suscripciones"];

/** Barra inferior en móvil: 3 destinos fijos + "Más". */
export function SuperBottomNav({ badges = {} }: NavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const primary = NAV_ITEMS.filter((i) => PRIMARY_HREFS.includes(i.href));
  const rest = NAV_ITEMS.filter((i) => !PRIMARY_HREFS.includes(i.href));

  // Un pendiente dentro de "Más" tiene que verse desde afuera: si no, no hay
  // forma de saber que hay algo esperando ahí.
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
          className="fixed inset-0 z-40 bg-ink-950/45 backdrop-blur-[2px] md:hidden"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Hoja "Más" */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-background",
          "pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-pop md:hidden",
          "transition-transform duration-300 ease-out",
          sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        aria-hidden={!sheetOpen}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-ink-300" />
        <div className="grid grid-cols-3 gap-1.5 p-3">
          {rest.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl p-2",
                  "text-center text-2xs font-medium transition-colors duration-150",
                  active
                    ? "bg-ink-100 text-foreground"
                    : "text-ink-600 hover:bg-ink-100/70",
                )}
              >
                <span className="relative">
                  <item.icon
                    className={cn("size-5", active ? "text-foreground" : "text-ink-500")}
                  />
                  {badge ? <Badge count={badge} onIcon /> : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación principal"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = badges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2",
                "text-2xs font-medium transition-colors duration-150",
                active ? "text-foreground" : "text-ink-500",
              )}
            >
              <span className="relative">
                <item.icon className="size-5" />
                {badge ? <Badge count={badge} onIcon /> : null}
              </span>
              {item.label}
              <span
                className={cn(
                  "absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full bg-foreground transition-opacity",
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
            "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2",
            "text-2xs font-medium transition-colors duration-150",
            sheetOpen || restActive ? "text-foreground" : "text-ink-500",
          )}
        >
          <span className="relative">
            <MoreHorizontal className="size-5" />
            {restBadge > 0 && !sheetOpen ? (
              <Badge count={restBadge} onIcon />
            ) : null}
          </span>
          Más
        </button>
      </nav>
    </>
  );
}
