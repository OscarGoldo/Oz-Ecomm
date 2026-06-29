"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { OzLogoMark } from "@/components/landing/oz-logo";

const NAV = [
  { label: "Soluciones", href: "#soluciones" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Precios", href: "#precios" },
  { label: "Plantillas", href: "#plantillas" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <header
        className={cn(
          "mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-black/5 bg-white/95 backdrop-blur transition-all duration-300",
          scrolled
            ? "px-4 py-2 shadow-lg shadow-black/[0.08]"
            : "px-5 py-3 shadow-md shadow-black/[0.04]",
        )}
      >
        {/* Left: logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2 text-primary">
          <OzLogoMark className="size-8" />
          <span className="text-lg tracking-tight">
            <span className="font-extrabold">Oz</span>
            <span className="font-medium">Shop</span>
          </span>
        </Link>

        {/* Center: nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/login"
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            Ingresar
          </Link>
          <Link
            href="/crear-tienda"
            className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Crear mi tienda
          </Link>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {open && (
        <div className="mx-auto mt-2 max-w-5xl rounded-3xl border border-black/5 bg-white p-3 shadow-lg shadow-black/[0.08] md:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition-colors hover:bg-muted"
            >
              Ingresar
            </Link>
            <Link
              href="/crear-tienda"
              onClick={() => setOpen(false)}
              className="rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Crear mi tienda
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
