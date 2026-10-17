"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Gift,
  LayoutDashboard,
  Lock,
  MessageSquare,
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

interface NavGroup {
  /** Rótulo de la sección. `null` = grupo sin encabezado (va primero). */
  label: string | null;
  items: NavItem[];
}

/**
 * Trece destinos en una sola lista no son un menú, son un inventario: sin
 * agrupar, el dueño lee los trece cada vez que busca uno. Los grupos son la
 * misma navegación de siempre —mismos enlaces, mismo orden relativo— pero
 * ordenada por el trabajo que viene a hacer: vender, mantener el catálogo,
 * ver cómo va el negocio.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/panel", label: "Resumen", icon: LayoutDashboard }],
  },
  {
    label: "Ventas",
    items: [
      { href: "/panel/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "/panel/carritos", label: "Carritos", icon: ShoppingCart },
      { href: "/panel/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/panel/productos", label: "Productos", icon: Package },
      { href: "/panel/categorias", label: "Categorías", icon: Tags },
      { href: "/panel/descuentos", label: "Descuentos", icon: Ticket, pro: true },
    ],
  },
  {
    label: "Tienda",
    items: [
      { href: "/panel/personalizar", label: "Diseño", icon: Palette },
      { href: "/panel/analitica", label: "Analítica", icon: BarChart3, pro: true },
    ],
  },
  {
    label: "Negocio",
    items: [
      { href: "/panel/finanzas", label: "Finanzas", icon: Wallet },
      { href: "/panel/referidos", label: "Referidos", icon: Gift },
    ],
  },
];

/**
 * En escritorio el plan no es un ítem más: va como tarjeta abajo de la barra
 * lateral, con el cupo de productos a la vista (ver PanelPlanCard). En móvil
 * no hay tarjeta, así que sigue apareciendo dentro de "Más".
 */
const PLAN_ITEM: NavItem = { href: "/panel/plan", label: "Plan", icon: Sparkles };

/**
 * Ajustes vive abajo, separado del resto: es configuración, no una sección
 * del día a día, y perdido en el medio de trece ítems no se encontraba.
 * Comentarios lo acompaña por lo mismo: no es parte de vender, es el canal
 * para hablar con Tiendify, y tiene que estar siempre en el mismo lugar.
 * En móvil siguen apareciendo dentro de "Más" como cualquier otro.
 */
const FOOTER_ITEMS: NavItem[] = [
  { href: "/panel/comentarios", label: "Comentarios", icon: MessageSquare },
  { href: "/panel/configuracion", label: "Ajustes", icon: Settings },
];

/** Orden plano, para la barra inferior de móvil. */
const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  PLAN_ITEM,
  ...FOOTER_ITEMS,
];

/** El único pendiente que va en amarillo: pagos por revisar o por llegar. */
const URGENT_BADGE_HREF = "/panel/pedidos";

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

/**
 * Desktop sidebar navigation (md and up). Va sobre la barra noche: texto
 * blanco atenuado, la sección activa con un fondo apenas más claro y el ícono
 * en el azul de marca. `plan` es la tarjeta del plan, que va abajo, antes de
 * Comentarios y Ajustes.
 */
export function PanelSidebarNav({
  badges = {},
  pro = false,
  plan,
}: NavProps & { plan?: React.ReactNode }) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const badge = badges[item.href];
    const locked = Boolean(item.pro) && !pro;
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
        {locked && (
          <span
            className="ml-auto rounded-[5px] border border-white/20 px-1 py-px font-landing-mono text-[10px] font-semibold tracking-[0.06em] text-niebla"
            aria-label="Requiere Pro"
          >
            PRO
          </span>
        )}
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
  };

  return (
    <nav aria-label="Secciones del panel" className="flex flex-1 flex-col">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? "root"} className={cn(i > 0 && "mt-3.5")}>
          {group.label && (
            <p className="mb-1 px-2.5 font-landing-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7F93A8]">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">{group.items.map(renderItem)}</div>
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-2.5 pt-5">
        {plan}
        <div className="flex flex-col gap-0.5">{FOOTER_ITEMS.map(renderItem)}</div>
      </div>
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
            const locked = Boolean(item.pro) && !pro;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl p-2",
                  "text-2xs font-medium transition-colors duration-150",
                  active
                    ? "bg-ink-100 text-foreground"
                    : "text-ink-600 hover:bg-ink-100/70",
                )}
              >
                <span className="relative">
                  <item.icon
                    className={cn("size-5", active ? "text-foreground" : "text-ink-500")}
                  />
                  {locked && (
                    <span className="absolute -right-2 -top-1 grid size-3.5 place-items-center rounded-full bg-ink-200 text-ink-600">
                      <Lock className="size-2" />
                    </span>
                  )}
                  {badge ? (
                    <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-sol px-1 text-3xs font-bold leading-4 tabular-nums text-noche">
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
                {badge ? (
                  <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-sol px-1 text-3xs font-bold leading-4 tabular-nums text-noche">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
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
              <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-sol px-1 text-3xs font-bold leading-4 tabular-nums text-noche">
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
