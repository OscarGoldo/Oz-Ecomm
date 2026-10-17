"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import { cn } from "@/lib/utils";

/**
 * Cada enlace tiene que apuntar a una sección que exista de verdad en la
 * landing. "Soluciones" y "Plataforma" no existían: eran anclas muertas que no
 * hacían nada al tocarlas.
 */
const NAV = [
  { label: "Inicio", id: "inicio" },
  { label: "Tiendas", id: "tiendas" },
  { label: "Funciones", id: "funciones" },
  { label: "Precios", id: "precios" },
  { label: "Preguntas", id: "preguntas" },
];

/** Curvas fuertes: salida para lo que entra y sale, in-out para lo que se mueve. */
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_MOVE = "cubic-bezier(0.77, 0, 0.175, 1)";

/**
 * La barra: noche, ancha, pegada arriba y flotando sobre el azul del hero.
 * Ocupa 86px pero le devuelve ese alto con un margen negativo, y el hero lo
 * compensa con su padding, así el azul llega hasta arriba.
 *
 * Dos movimientos:
 *  - La sección activa se marca con una pastilla blanca que se desliza por el
 *    riel. Es una copia de las etiquetas en blanco, recortada con clip-path a
 *    la sección activa: fondo y texto cambian juntos porque son el mismo
 *    elemento, en vez de dos colores animándose por separado.
 *  - En el teléfono, el menú sale del botón y sus enlaces entran escalonados,
 *    mientras las tres rayas se vuelven una X.
 */
export function LandingHeader() {
  const [active, setActive] = useState(NAV[0]!.id);
  const [open, setOpen] = useState(false);
  // Cerrar con Esc es una acción de teclado: se cierra sin animación.
  const [instant, setInstant] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const activeRef = useRef(active);
  const spyPausedUntil = useRef(0);

  /** Recorta la copia blanca a la sección activa. */
  const placePill = useCallback((jump: boolean) => {
    const pill = pillRef.current;
    const link = linkRefs.current[activeRef.current];
    if (!pill || !link) return;
    if (jump) pill.style.transition = "none";
    const left = link.offsetLeft - pill.offsetLeft;
    const right = pill.offsetWidth - left - link.offsetWidth;
    pill.style.clipPath = `inset(0 ${right}px 0 ${left}px round 999px)`;
    if (jump) requestAnimationFrame(() => requestAnimationFrame(() => (pill.style.transition = "")));
  }, []);

  useEffect(() => {
    activeRef.current = active;
    placePill(false);
  }, [active, placePill]);

  // Primera posición, y de nuevo si cambia el ancho o terminan de cargar las
  // fuentes: en esos casos salta sin animarse.
  useEffect(() => {
    placePill(true);
    document.fonts?.ready.then(() => placePill(true));
    const track = trackRef.current;
    if (!track || !("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => placePill(true));
    ro.observe(track);
    return () => ro.disconnect();
  }, [placePill]);

  // La sección que ocupa la franja central de la pantalla es la activa.
  useEffect(() => {
    const targets = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < spyPausedUntil.current) return;
        entries.forEach((en) => {
          if (en.isIntersecting) setActive(en.target.id);
        });
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    const onScrollEnd = () => (spyPausedUntil.current = 0);
    window.addEventListener("scrollend", onScrollEnd);
    return () => {
      io.disconnect();
      window.removeEventListener("scrollend", onScrollEnd);
    };
  }, []);

  /**
   * Al tocar un enlace la pastilla va directo ahí. Mientras la página se
   * desplaza, el seguimiento espera: si no, la pastilla pasaría por cada
   * sección del camino.
   */
  const go = (id: string) => {
    setActive(id);
    spyPausedUntil.current = Date.now() + 1200;
  };

  // El menú cerrado no se puede enfocar ni leer.
  useEffect(() => {
    if (menuRef.current) menuRef.current.inert = !open;
  }, [open]);

  // Se cierra tocando afuera o con Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setInstant(true);
      setOpen(false);
      menuBtnRef.current?.focus();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  const pillText = "rounded-full px-4 py-2 text-[14.5px] font-semibold";
  const menuItems = [
    ...NAV.map((n) => ({ label: n.label, href: `#${n.id}`, id: n.id, cta: false })),
    { label: "Ingresar", href: "/login", id: "", cta: false },
    { label: "Crear mi tienda gratis", href: "/crear-tienda", id: "", cta: true },
  ];

  return (
    <div className="pointer-events-none sticky top-0 z-50 -mb-[86px] h-[86px] px-4 pt-3">
      <nav
        ref={navRef}
        aria-label="Principal"
        className="pointer-events-auto relative mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 rounded-[18px] border border-white/[0.08] bg-noche pl-4 pr-2.5 text-white shadow-[0_20px_44px_-22px_hsl(var(--noche)/0.6)] sm:pl-5"
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label="Tiendify, inicio">
          <TiendifyLogo variant="white" className="h-8 w-auto" />
        </Link>

        {/* El riel con la pastilla */}
        <div
          ref={trackRef}
          className="relative hidden gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.06] p-1 lg:flex"
        >
          {NAV.map((n) => (
            <a
              key={n.id}
              ref={(el) => {
                linkRefs.current[n.id] = el;
              }}
              href={`#${n.id}`}
              onClick={() => go(n.id)}
              aria-current={active === n.id ? "true" : undefined}
              className={cn(
                pillText,
                "text-white/70 transition-colors duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:outline-brand-400",
              )}
            >
              {n.label}
            </a>
          ))}
          <span
            ref={pillRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-1 flex gap-0.5 rounded-full bg-white transition-[clip-path] duration-[250ms] ease-[cubic-bezier(0.77,0,0.175,1)] [clip-path:inset(0_100%_0_0_round_999px)]"
          >
            {NAV.map((n) => (
              <span key={n.id} className={cn(pillText, "whitespace-nowrap text-noche")}>
                {n.label}
              </span>
            ))}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="hidden min-h-[42px] items-center rounded-full bg-white/[0.08] px-[18px] text-[14.5px] font-semibold transition-colors hover:bg-white/15 sm:inline-flex"
          >
            Ingresar
          </Link>
          <Link
            href="/crear-tienda"
            className="inline-flex min-h-[42px] items-center whitespace-nowrap rounded-full bg-white px-[18px] text-[14.5px] font-bold text-noche transition-transform active:scale-[0.97] max-[420px]:hidden"
          >
            Crear mi tienda
          </Link>

          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="menu-landing"
            className="grid size-[42px] place-items-center rounded-full bg-white/[0.08] transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] lg:hidden [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/15"
          >
            {/* Tres rayas que se vuelven una X */}
            <span aria-hidden="true" className="relative block h-3.5 w-[18px]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute left-0 h-[1.8px] w-full rounded-full bg-current"
                  style={{
                    top: `${i * 6.1}px`,
                    transition: `transform 200ms ${EASE_MOVE}, opacity 150ms ${EASE_OUT}`,
                    opacity: open && i === 1 ? 0 : 1,
                    transform: !open
                      ? "none"
                      : i === 0
                        ? "translateY(6.1px) rotate(45deg)"
                        : i === 1
                          ? "scaleX(0.3)"
                          : "translateY(-6.1px) rotate(-45deg)",
                  }}
                />
              ))}
            </span>
          </button>
        </div>

        {/* Menú del teléfono: sale del botón (arriba a la derecha). Se queda
            montado y se esconde con visibility, así la salida también se anima. */}
        <div
          ref={menuRef}
          id="menu-landing"
          className="absolute inset-x-0 top-[calc(100%+8px)] grid gap-0.5 rounded-[20px] border border-white/10 bg-noche p-2.5 shadow-[0_28px_56px_-22px_hsl(var(--noche)/0.5)] lg:hidden"
          style={{
            transformOrigin: "calc(100% - 31px) 0",
            opacity: open ? 1 : 0,
            transform: open ? "none" : "scale(0.96) translateY(-6px)",
            visibility: open ? "visible" : "hidden",
            pointerEvents: open ? "auto" : "none",
            transition: instant
              ? "none"
              : `opacity 200ms ${EASE_OUT}, transform 200ms ${EASE_OUT}, visibility 0s linear ${open ? "0s" : "200ms"}`,
          }}
        >
          {menuItems.map((item, i) => {
            const delay = open ? i * 20 : 0;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => {
                  if (item.id) go(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-xl px-4 py-3 font-semibold",
                  item.cta
                    ? "mt-2 bg-white text-center font-bold text-noche"
                    : "text-white/85 hover:bg-white/[0.08]",
                )}
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : "translateY(-4px)",
                  transition: instant
                    ? "none"
                    : `opacity 160ms ${EASE_OUT} ${delay}ms, transform 160ms ${EASE_OUT} ${delay}ms, background-color 200ms ease`,
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
