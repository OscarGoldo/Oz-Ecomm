import type { Metadata } from "next";
import {
  Bebas_Neue,
  Instrument_Sans,
  Inter,
  Lora,
  Montserrat,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
// Display de la plataforma (panel, landing, super-admin). Es la que carga los
// titulares y las cifras grandes. Va aparte de Inter a propósito: Inter sola
// en todos los tamaños es exactamente el aspecto de plantilla sin dirección
// tipográfica. Instrument Sans tiene aperturas más cerradas y aguanta el
// tracking negativo en tamaños de titular sin abrirse.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});
// Display fonts: per-template heading identities (see LAYOUT_CHROME).
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  // Sin esto Next emite `og:image` como ruta relativa y WhatsApp la descarta:
  // exige URL absoluta para mostrar la preview.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tiendifyapp.com",
  ),
  title: {
    default: "Tiendify",
    template: "%s · Tiendify",
  },
  description:
    "Plataforma de ecommerce para PYMEs de Venezuela. Tu tienda online con pagos locales y doble moneda.",
  icons: {
    icon: [
      { url: "/tiendify-symbol.svg", type: "image/svg+xml" },
      { url: "/tiendify-app-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/tiendify-app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${instrumentSans.variable} ${poppins.variable} ${montserrat.variable} ${lora.variable} ${bebas.variable} ${playfair.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
