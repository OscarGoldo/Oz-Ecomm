"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  searchStores,
  type StoreSearchHit,
} from "@/app/(superadmin)/super/actions";
import { cn } from "@/lib/utils";

/**
 * El buscador de arriba del super admin: se escribe un nombre, un correo o un
 * WhatsApp desde cualquier pantalla y se cae en la ficha de esa tienda.
 *
 * Enter abre el primer resultado. Si no hay ninguno, lleva a la tabla de
 * tiendas con el texto puesto, que busca más flojo y deja filtrar.
 */
export function SuperSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StoreSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ctrl+K / ⌘K lleva el cursor al buscador desde cualquier parte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Se busca cuando se deja de escribir, no en cada tecla. `stale` descarta la
  // respuesta de una búsqueda vieja que llegue después de una más nueva.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await searchStores(q).catch(() => []);
      if (stale) return;
      setHits(res);
      setLoading(false);
    }, 220);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Tocar afuera cierra la lista.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Al llegar a otra pantalla el buscador queda limpio.
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (hits.length > 0) router.push(`/super/tiendas/${hits[0].id}`);
    else router.push(`/super/tiendas?q=${encodeURIComponent(q)}`);
    inputRef.current?.blur();
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="super-search" className="sr-only">
          Buscar una tienda
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          id="super-search"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Buscar tienda, dueño, correo o WhatsApp"
          autoComplete="off"
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-base md:text-sm",
            "placeholder:text-muted-foreground/80",
            "outline-none transition-[border-color,box-shadow] duration-150 ease-out",
            "focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]",
            // La X nativa de type=search se pisa con el borde en Chrome.
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover shadow-pop">
          {hits.length > 0 ? (
            <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/super/tiendas/${h.id}`}
                    className="block px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <span className="block truncate text-sm font-medium">
                      {h.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {h.ownerName ?? "Sin dueño asignado"}
                      {h.ownerEmail ? ` · ${h.ownerEmail}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {loading
                ? "Buscando…"
                : "Ninguna tienda coincide. Enter para buscar en la tabla."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
