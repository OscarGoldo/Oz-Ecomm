/**
 * Opciones del listado de Productos que comparten la página (servidor) y los
 * filtros (cliente). Van aparte porque lo que exporta un archivo "use client"
 * le llega al servidor como referencia, no como valor.
 */

/** La vista elegida se recuerda en una cookie: el servidor ya la sabe al pintar. */
export const PRODUCTS_VIEW_COOKIE = "panel_productos_vista";

export type ProductsView = "fotos" | "lista";

export const PRODUCT_SORTS = [
  { value: "vendidos", label: "Más vendidos (30 días)" },
  { value: "vistos", label: "Más vistos (30 días)" },
  { value: "recientes", label: "Recién cargados" },
  { value: "precio-menor", label: "Precio: de menor a mayor" },
  { value: "precio-mayor", label: "Precio: de mayor a menor" },
  { value: "stock", label: "Menos stock primero" },
  { value: "nombre", label: "Nombre (A–Z)" },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export function isProductSort(v: string | undefined): v is ProductSort {
  return PRODUCT_SORTS.some((s) => s.value === v);
}
