"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageOff, Search, X } from "lucide-react";

import { useStoreHref } from "@/components/storefront/store-base";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import { suggestProducts } from "@/lib/search-actions";
import type { ProductSuggestion } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { Store } from "@/types/database";

export type SearchStore = Pick<Store, "slug" | "exchange_rate" | "show_bs_prices">;

/**
 * El buscador de la tienda. Desde la segunda letra abre una lista con los
 * productos que coinciden; tocar uno lleva directo a él, y Enter (o "Ver todos")
 * abre la página de resultados de siempre, `?q=`.
 *
 * Antes solo buscaba con Enter, y borrar el texto no deshacía la búsqueda: la
 * página seguía filtrada hasta dar Enter otra vez. Ahora vaciarlo vuelve solo
 * al catálogo completo.
 *
 * Lo usan el encabezado (HeaderSearch) y el buscador grande de la portada
 * (StoreSearch); cada uno le pone su ropa con las clases.
 */
export function ProductSearch({
  store,
  placeholder = "Buscar productos…",
  inputClassName,
  iconClassName,
  clearClassName = "text-muted-foreground hover:text-foreground",
}: {
  store: SearchStore;
  placeholder?: string;
  /** Alto, fondo, borde, letra, sangría y anillo de foco del cuadro. */
  inputClassName: string;
  /** Tamaño, color y distancia al borde de la lupa. */
  iconClassName: string;
  /** Color de la X que borra, para que se lea sobre el fondo del cuadro. */
  clearClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const link = useStoreHref(store.slug);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  const cache = useRef(new Map<string, ProductSuggestion[]>());

  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [hits, setHits] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  // El texto sigue a la dirección: en los resultados muestra lo buscado (aunque
  // se haya buscado desde el otro cuadro) y al abrir un producto queda vacío.
  // Mientras se escribe no se pisa, para no borrar letras que llegan antes que
  // la navegación.
  useEffect(() => {
    const moved = pathname !== lastPath.current;
    lastPath.current = pathname;
    if (!moved && document.activeElement === inputRef.current) return;
    setQ(urlQ);
    setOpen(false);
  }, [pathname, urlQ]);

  // Se pide la lista cuando se deja de escribir, no en cada tecla. `stale`
  // descarta la respuesta de una búsqueda vieja que llegue después de otra.
  useEffect(() => {
    setActive(-1);
    if (!open) return;
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const known = cache.current.get(term);
    if (known) {
      setHits(known);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await suggestProducts(store.slug, term).catch(() => null);
      if (stale) return;
      if (res) cache.current.set(term, res);
      setHits(res ?? []);
      setLoading(false);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, open, store.slug]);

  // Tocar afuera cierra la lista.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function change(value: string) {
    setQ(value);
    setOpen(true);
    // Vaciarlo estando en los resultados vuelve al catálogo, sin otro Enter.
    if (value.trim() === "" && urlQ) {
      const sp = new URLSearchParams(params.toString());
      sp.delete("q");
      sp.delete("ver");
      const rest = sp.toString();
      router.replace(link(rest ? `?${rest}` : ""));
    }
  }

  function go(href: string) {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function showAll() {
    const term = q.trim();
    go(term ? link(`?q=${encodeURIComponent(term)}#catalogo`) : link());
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const picked = open ? hits[active] : undefined;
    if (picked) go(link(`/producto/${picked.slug}`));
    else showAll();
  }

  const term = q.trim();
  const showPanel = open && term.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2",
            iconClassName,
          )}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hits.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % hits.length);
            } else if (e.key === "ArrowUp" && hits.length > 0) {
              e.preventDefault();
              setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
            } else if (e.key === "Escape" && showPanel) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label="Buscar productos"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={
            showPanel && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          className={cn(
            "w-full outline-none ring-offset-2 pr-10",
            // La X propia de abajo reemplaza la del navegador, que no sale en
            // todos los teléfonos.
            "[&::-webkit-search-cancel-button]:hidden",
            inputClassName,
          )}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              change("");
              inputRef.current?.focus();
            }}
            aria-label="Borrar búsqueda"
            className={cn(
              "absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full transition-colors",
              clearClassName,
            )}
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {hits.length > 0 ? (
            <>
              <ul
                id={listId}
                role="listbox"
                aria-label="Productos sugeridos"
                className="max-h-[50dvh] overflow-y-auto py-1"
              >
                {hits.map((p, i) => (
                  <li
                    key={p.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                  >
                    {/* Sin prefetch: la lista cambia con cada pausa al escribir
                        y precargaría seis páginas cada vez. */}
                    <Link
                      href={link(`/producto/${p.slug}`)}
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 transition-colors",
                        i === active && "bg-muted",
                      )}
                    >
                      <Thumb src={p.image} alt={p.name} faded={!p.available} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.available ? priceLine(p, store) : "Agotado"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={showAll}
                className="block w-full truncate border-t px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                Ver todos los resultados para “{term}”
              </button>
            </>
          ) : (
            <p id={listId} className="px-3 py-3 text-sm text-muted-foreground">
              {loading ? "Buscando…" : `No hay productos con “${term}”.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({
  src,
  alt,
  faded,
}: {
  src: string | null;
  alt: string;
  faded: boolean;
}) {
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-white text-muted-foreground">
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={40}
          height={40}
          className={cn("size-10 object-contain p-0.5", faded && "opacity-50")}
        />
      ) : (
        <ImageOff className="size-4" />
      )}
    </span>
  );
}

function priceLine(p: ProductSuggestion, store: SearchStore): string {
  const usd = formatUSD(p.price);
  const bs = store.show_bs_prices ? usdToBs(p.price, store.exchange_rate) : null;
  return bs === null ? usd : `${usd} · ${formatBs(bs)}`;
}
