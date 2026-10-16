"use client";

import { createContext, useCallback, useContext } from "react";

import { joinStorePath } from "@/lib/store-url";

/**
 * La base de los enlaces de la tienda para los Client Components: "" cuando se
 * ve en su subdominio, "/mitienda" cuando se ve en usatiendify.com/mitienda.
 *
 * La calcula el layout de la tienda en el servidor (store-href.ts) y la baja
 * por contexto. No se puede deducir de `window.location` acá: en el render del
 * servidor no hay `window`, y el HTML no coincidiría con el del navegador.
 */
const StoreBaseContext = createContext<string | null>(null);

export function StoreBaseProvider({
  base,
  children,
}: {
  base: string;
  children: React.ReactNode;
}) {
  return <StoreBaseContext.Provider value={base}>{children}</StoreBaseContext.Provider>;
}

/**
 * `link("/producto/x")` → "/producto/x" o "/mitienda/producto/x".
 *
 * Fuera de la tienda (no hay provider) cae en "/<slug>", la dirección que
 * funciona siempre.
 */
export function useStoreHref(slug: string): (path?: string) => string {
  const base = useContext(StoreBaseContext) ?? `/${slug}`;
  return useCallback((path = "") => joinStorePath(base, path), [base]);
}
