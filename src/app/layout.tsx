import type { Metadata } from "next";
import { Inter, Lora, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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

export const metadata: Metadata = {
  title: {
    default: "OzShop",
    template: "%s · OzShop",
  },
  description:
    "Plataforma de ecommerce para PYMEs de Venezuela. Tu tienda online con pagos locales y doble moneda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${poppins.variable} ${montserrat.variable} ${lora.variable}`}
    >
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
