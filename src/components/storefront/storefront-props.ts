import type { ComponentType } from "react";

import type { StoreTheme, LayoutId } from "@/lib/theme";
import type { Category, Product, Store } from "@/types/database";

/**
 * El contrato único de una plantilla de tienda.
 *
 * Antes cada una declaraba su propia interfaz con un subconjunto distinto de
 * los mismos props, y `page.tsx` tenía once bloques `if (theme.layout === …)`
 * casi idénticos para armarlos a mano. El costo real no era la repetición sino
 * el mantenimiento: agregar un prop —la paginación, por ejemplo— obligaba a
 * editar once bloques y once interfaces, y olvidarse de uno no daba error de
 * compilación, solo una plantilla que se comportaba distinto.
 *
 * Con un contrato compartido, un prop nuevo se agrega una vez y el compilador
 * marca cualquier plantilla que no lo contemple. Cada una desestructura lo que
 * usa e ignora el resto: `banner` y `featured` van siempre, aunque las
 * plantillas más simples no los miren.
 */
export interface StorefrontProps {
  store: Store;
  theme: StoreTheme;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  /** Destacados con stock. Vacío cuando hay filtros activos. */
  featured: Product[];
  hasFilters: boolean;
  heading: string;
  banner: string | null;
  hero: { headline: string; subtext: string; cta: string };
}

export type StorefrontComponent = ComponentType<StorefrontProps>;

/** Plantillas con estructura propia. `classic` no está: lo arma `page.tsx`. */
export type VerticalLayoutId = Exclude<LayoutId, "classic">;
