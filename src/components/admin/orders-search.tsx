"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Buscador de pedidos por número, nombre o teléfono.
 *
 * Es lo que el dueño tiene a mano cuando un cliente le escribe "¿qué pasó con
 * mi pedido?". Sin esto había que scrollear la lista completa a ojo.
 */
export function OrdersSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  // Con retardo: cada tecla disparaba una consulta al servidor.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value.trim()) sp.set("q", value.trim());
      else sp.delete("q");
      // Cambiar la búsqueda vuelve a la primera página.
      sp.delete("ver");
      router.replace(`${pathname}?${sp.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="search"
        inputMode="search"
        placeholder="Buscar por N° de pedido, nombre o teléfono"
        className="h-11 pl-9 pr-10"
        aria-label="Buscar pedidos"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
