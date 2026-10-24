"use client";

import { ProductSearch, type SearchStore } from "@/components/storefront/product-search";

/**
 * El buscador grande de las portadas "con buscador" (plantilla Tech y su
 * versión del editor por secciones).
 *
 * Antes filtraba el catálogo con cada pausa al escribir, cambiando `?q=`. En el
 * editor por secciones la portada se esconde cuando hay búsqueda, así que el
 * cuadro desaparecía a mitad de la palabra. Ahora funciona como el del
 * encabezado: sugiere mientras se escribe y busca con Enter.
 */
export function StoreSearch({
  store,
  placeholder,
}: {
  store: SearchStore;
  placeholder?: string;
}) {
  return (
    <ProductSearch
      store={store}
      placeholder={placeholder}
      inputClassName="h-14 rounded-lg border border-input bg-background pl-11 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      iconClassName="left-4 size-5 text-muted-foreground"
    />
  );
}
