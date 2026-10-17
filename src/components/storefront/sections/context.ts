import type { CardStyle } from "@/lib/theme";
import type { Density, LookId } from "@/lib/design/types";
import type { Category, Product, Store } from "@/types/database";

/**
 * Lo que todas las secciones necesitan saber para dibujarse: la tienda, sus
 * productos y en qué modo se está viendo (la tienda pública o la vista previa
 * del editor).
 */
export interface HomeContext {
  store: Store;
  /** El estilo de la tienda: marca el marco de cada sección y la portada por defecto. */
  look: LookId;
  /** De qué estilo es la tarjeta de producto (y su grilla). */
  cardLook: LookId;
  /** De qué estilo son los títulos de sección. */
  headingLook: LookId;
  density: Density;
  cardStyle: CardStyle;
  categories: Pick<Category, "id" | "name" | "slug">[];
  categoryNames: Map<string, string>;
  /** La página del catálogo que se está mostrando (con "Ver más" crece). */
  products: Product[];
  /** Destacados con stock. */
  featured: Product[];
  hasFilters: boolean;
  /** Título del catálogo cuando hay búsqueda o categoría. */
  heading: string;
  /** El banner de la tienda (Configuración), para las portadas sin fotos propias. */
  banner: string | null;
  /** "Tasa BCV: …" para la portada clásica. */
  rateLabel: string | null;
  freeShipping: boolean;
  /** Vista previa del editor: las secciones vacías muestran por qué no se ven. */
  editing: boolean;
  /** Hay una sección de categorías visible: el catálogo no repite los filtros. */
  hasCategoryNav: boolean;
  /** Enlace dentro de la tienda ("/producto/x", "?cat=y"). */
  link: (path?: string) => string;
}
