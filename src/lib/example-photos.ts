import type { RubroId } from "@/lib/design/bases";

/**
 * Fotos de stock para las páginas ejemplo de /super/ejemplos: las que se usan
 * mientras todavía no hay fotos reales del negocio. Son de Unsplash (licencia
 * libre, uso comercial permitido) y se sirven desde su CDN, igual que las de
 * Alfa Electronic: next.config.mjs ya acepta `images.unsplash.com/photo-*`.
 *
 * La IA que propone el catálogo elige de esta lista solo cuando una foto
 * muestra de verdad el producto; si no, el producto queda sin foto hasta que
 * los socios suban la del negocio. Por eso cada foto lleva lo que muestra,
 * no lo que "podría ser".
 */

export interface StockPhoto {
  /** El id de Unsplash, con el prefijo `photo-`. */
  id: string;
  /** Lo que se ve en la foto, corto y en español. */
  label: string;
  rubro: RubroId;
}

export const STOCK_PHOTOS: StockPhoto[] = [
  // Moda
  { id: "photo-1602010069450-0a62034f235c", label: "Vestido floral largo", rubro: "moda" },
  { id: "photo-1623580674393-edf6eb7090f8", label: "Vestido negro sin mangas", rubro: "moda" },
  { id: "photo-1713881676551-b16f22ce4719", label: "Camisa blanca de lino", rubro: "moda" },
  { id: "photo-1673925205809-601b5a22eb61", label: "Crop top blanco con jean", rubro: "moda" },
  { id: "photo-1598554747436-c9293d6a588f", label: "Jean azul de tiro alto", rubro: "moda" },
  { id: "photo-1610241532145-96771e5088e8", label: "Jean ancho con camisa negra", rubro: "moda" },
  { id: "photo-1611312449408-fcece27cdbb7", label: "Chaqueta de jean", rubro: "moda" },
  { id: "photo-1598532163257-ae3c6b2524b6", label: "Cartera de cuero marrón", rubro: "moda" },
  { id: "photo-1619510331283-a46c425e48bb", label: "Sandalias planas", rubro: "moda" },
  { id: "photo-1584036553516-bf83210aa16c", label: "Lentes de sol negros", rubro: "moda" },

  // Comida
  { id: "photo-1568901346375-23c9450c58cd", label: "Hamburguesa con lechuga y tomate", rubro: "comida" },
  { id: "photo-1572802419224-296b0aeee0d9", label: "Hamburguesa doble con queso", rubro: "comida" },
  { id: "photo-1638368593249-7cadb261e8b3", label: "Perro caliente con salsas", rubro: "comida" },
  { id: "photo-1778449665117-2c607bbc7415", label: "Palitos de queso empanizados (tequeños)", rubro: "comida" },
  { id: "photo-1769812344068-9e4b7d8a3eb0", label: "Bandeja de pastelitos dorados", rubro: "comida" },
  { id: "photo-1639744210631-209fce3e256c", label: "Papas fritas con queso", rubro: "comida" },
  { id: "photo-1559620192-032c4bc4674e", label: "Torta redonda con crema blanca", rubro: "comida" },
  { id: "photo-1702728109878-c61a98d80491", label: "Postre individual tipo flan", rubro: "comida" },
  { id: "photo-1606313564200-e75d5e30476c", label: "Brownies de chocolate", rubro: "comida" },
  { id: "photo-1623084921164-4a8c5c37a912", label: "Vaso de limonada", rubro: "comida" },

  // Belleza
  { id: "photo-1781344116880-029945a42b75", label: "Sérum en frasco gotero", rubro: "belleza" },
  { id: "photo-1765964492963-b0aa8c172431", label: "Crema facial en tarro", rubro: "belleza" },
  { id: "photo-1738721796993-5f42d9315689", label: "Protector solar", rubro: "belleza" },
  { id: "photo-1522335789203-aabd1fc54bc9", label: "Maquillaje variado", rubro: "belleza" },
  { id: "photo-1625093742435-6fa192b6fb10", label: "Labial rojo", rubro: "belleza" },
  { id: "photo-1768983224486-b4dcd179b4a5", label: "Paleta de sombras", rubro: "belleza" },
  { id: "photo-1792071569385-5d38c88dadcd", label: "Aceite para el cabello", rubro: "belleza" },
  { id: "photo-1763987300719-fd27c51a3227", label: "Esmaltes de uñas", rubro: "belleza" },
  { id: "photo-1596462502278-27bfdc403348", label: "Set de brochas de maquillaje", rubro: "belleza" },

  // Tecnología
  { id: "photo-1523206489230-c012c64b2b48", label: "iPhone en la mano", rubro: "tecnologia" },
  { id: "photo-1616410011236-7a42121dd981", label: "Tres teléfonos de colores", rubro: "tecnologia" },
  { id: "photo-1634403665481-74948d815f03", label: "Teléfono blanco, fondo rosado", rubro: "tecnologia" },
  { id: "photo-1480694313141-fce5e697ee25", label: "Teléfono Android plateado", rubro: "tecnologia" },
  { id: "photo-1535157412991-2ef801c1748b", label: "Forros de teléfono de colores", rubro: "tecnologia" },
  { id: "photo-1583863788434-e58a36330cf0", label: "Cargador de pared blanco", rubro: "tecnologia" },
  { id: "photo-1619459072761-496c0812331b", label: "Cable USB blanco", rubro: "tecnologia" },
  { id: "photo-1760708825913-65a50b3dc39b", label: "Power bank con cables", rubro: "tecnologia" },
  { id: "photo-1606741965326-cb990ae01bb2", label: "Audífonos inalámbricos con estuche", rubro: "tecnologia" },
  { id: "photo-1505740420928-5e560c06d30e", label: "Audífonos de diadema", rubro: "tecnologia" },
  { id: "photo-1589003077984-894e133dabab", label: "Corneta bluetooth portátil", rubro: "tecnologia" },
  { id: "photo-1579586337278-3befd40fd17a", label: "Reloj inteligente", rubro: "tecnologia" },

  // Hogar
  { id: "photo-1584990347193-6bebebfeaeee", label: "Ollas de acero", rubro: "hogar" },
  { id: "photo-1518291344630-4857135fb581", label: "Sartén", rubro: "hogar" },
  { id: "photo-1564940735784-b15466e8dc09", label: "Batidora de pedestal", rubro: "hogar" },
  { id: "photo-1631008789162-950869f41805", label: "Platos de cerámica", rubro: "hogar" },
  { id: "photo-1580130281320-0ef0754f2bf7", label: "Lámpara de mesa", rubro: "hogar" },
  { id: "photo-1629949009765-40fc74c9ec21", label: "Cojín en un sofá", rubro: "hogar" },
  { id: "photo-1597696929736-6d13bed8e6a8", label: "Jarrones de cerámica", rubro: "hogar" },
  { id: "photo-1523471826770-c437b4636fe6", label: "Toallas", rubro: "hogar" },
  { id: "photo-1564019472231-4586c552dc27", label: "Sábanas y almohadas", rubro: "hogar" },
];

/** La foto grande de la portada de cada rubro. */
export const RUBRO_HERO_PHOTO: Record<RubroId, string> = {
  general: "photo-1441986300917-64674bd600d8",
  moda: "photo-1441984904996-e0b6ba687e04",
  comida: "photo-1466978913421-dad2ebd01d17",
  belleza: "photo-1785581778868-79100f7fe56c",
  tecnologia: "photo-1496171367470-9ed9a91ea931",
  hogar: "photo-1605774337664-7a846e9cdf17",
};

const UNSPLASH = "https://images.unsplash.com";

/** La foto de producto, cuadrada. `size` chico para las miniaturas del selector. */
export function stockPhotoUrl(id: string, size = 900): string {
  return `${UNSPLASH}/${id}?w=${size}&h=${size}&fit=crop&q=80&auto=format`;
}

/** La foto de portada, apaisada. */
export function heroPhotoUrl(id: string): string {
  return `${UNSPLASH}/${id}?w=1800&h=1000&fit=crop&q=80&auto=format`;
}

export function isStockPhotoId(id: string): boolean {
  return STOCK_PHOTOS.some((p) => p.id === id);
}
