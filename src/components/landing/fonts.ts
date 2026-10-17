import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from "next/font/google";

/**
 * Las tipografías de la landing. Viven acá y no en el layout raíz para que el
 * panel y las tiendas no las descarguen: solo la portada las usa.
 *
 * - Bricolage Grotesque, con el eje de ancho: los titulares van comprimidos
 *   (`[font-stretch:82%]`) y negros, como los de los posts de Instagram.
 * - Figtree: el cuerpo de esos mismos posts.
 * - IBM Plex Mono: montos, tasas y referencias, que se leen como en un
 *   comprobante de Pago Móvil.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-landing-mono",
  display: "swap",
});

/** Las tres variables, para el contenedor raíz de la landing. */
export const landingFonts = `${display.variable} ${body.variable} ${mono.variable}`;
