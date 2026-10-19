"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_SORTS,
  PRODUCTS_VIEW_COOKIE,
  type ProductSort,
  type ProductsView,
} from "@/lib/catalog-view";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/database";

interface ProductsFiltersProps {
  categories: Pick<Category, "id" | "name">[];
  /** Hay productos sin categoría: se ofrece filtrarlos. */
  uncategorized: boolean;
  sort: ProductSort;
  view: ProductsView;
}

export function ProductsFilters({ categories, uncategorized, sort, view }: ProductsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") sp.delete(key);
      else sp.set(key, value);
    }
    // Filtrar de nuevo vuelve a la primera tanda.
    sp.delete("ver");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`);
    });
  }

  function setView(next: ProductsView) {
    if (next === view) return;
    document.cookie = `${PRODUCTS_VIEW_COOKIE}=${next}; path=/panel; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  // Debounce the search input.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => apply({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[1_1_180px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar productos"
          className="h-10 bg-card pl-9"
        />
      </div>
      <Select defaultValue={params.get("cat") ?? "all"} onValueChange={(v) => apply({ cat: v })}>
        <SelectTrigger className="h-10 min-w-0 flex-1 bg-card sm:w-48 sm:flex-none" aria-label="Categoría">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          {uncategorized && <SelectItem value="ninguna">Sin categoría</SelectItem>}
        </SelectContent>
      </Select>
      <Select defaultValue={sort} onValueChange={(v) => apply({ orden: v === "vendidos" ? "" : v })}>
        <SelectTrigger className="h-10 min-w-0 flex-1 bg-card sm:w-52 sm:flex-none" aria-label="Ordenar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* La cuadrícula con fotos solo existe en pantallas grandes. */}
      <div className="hidden overflow-hidden rounded-lg border bg-card lg:inline-flex" role="group" aria-label="Vista">
        {(
          [
            { id: "fotos", label: "Ver en cuadrícula", Icon: LayoutGrid },
            { id: "lista", label: "Ver en lista", Icon: List },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            aria-label={label}
            title={label}
            className={cn(
              "grid h-[38px] w-10 place-items-center text-ink-500 transition-colors hover:text-foreground",
              view === id && "bg-[#EEF3F8] text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
