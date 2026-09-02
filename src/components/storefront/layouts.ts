import { AccessoriesStorefront } from "@/components/storefront/accessories-storefront";
import { AthleteEditorialStorefront } from "@/components/storefront/athlete-editorial-storefront";
import { BeautyMinimalStorefront } from "@/components/storefront/beauty-minimal-storefront";
import { BeautyStorefront } from "@/components/storefront/beauty-storefront";
import { DiscoverStorefront } from "@/components/storefront/discover-storefront";
import { DropsStorefront } from "@/components/storefront/drops-storefront";
import { FashionStorefront } from "@/components/storefront/fashion-storefront";
import { SportsStorefront } from "@/components/storefront/sports-storefront";
import { StreetStorefront } from "@/components/storefront/streetwear-storefront";
import { TechStorefront } from "@/components/storefront/tech-storefront";
import type {
  StorefrontComponent,
  VerticalLayoutId,
} from "@/components/storefront/storefront-props";

/**
 * Qué componente dibuja cada plantilla vertical.
 *
 * `Record` completo y no `Partial`: si mañana se agrega un layout a
 * `LayoutId` y nadie escribe su componente, esto no compila. Antes ese olvido
 * caía silenciosamente en la plantilla clásica y el comerciante veía otra
 * tienda de la que había elegido.
 */
export const LAYOUTS: Record<VerticalLayoutId, StorefrontComponent> = {
  fashion: FashionStorefront,
  "fashion-athletic": AthleteEditorialStorefront,
  "fashion-streetwear": StreetStorefront,
  accessories: AccessoriesStorefront,
  beauty: BeautyStorefront,
  "beauty-minimal": BeautyMinimalStorefront,
  tech: TechStorefront,
  "tech-discover": DiscoverStorefront,
  sports: SportsStorefront,
  "sports-drops": DropsStorefront,
};
