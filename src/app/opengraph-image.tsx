import { ImageResponse } from "next/og";

import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  loadGoogleFont,
  publicHost,
} from "@/lib/og";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";

/**
 * La tarjeta de Tiendify: lo que se ve al pegar usatiendify.com (o el link de
 * /crear-tienda de una campaña) en WhatsApp, Instagram o X.
 *
 * Vive en la raíz, así que la heredan todas las páginas que no traen la suya.
 * Las tiendas y los productos sí la traen (ver [store_slug]/opengraph-image.tsx)
 * y esas mandan sobre esta.
 *
 * Va con la misma cara que los posts de Instagram (marketing/plantilla.html):
 * fondo noche, titular ultra-negro y apretado que termina en azul con punto. La
 * gente que llega por un anuncio tiene que reconocer la marca al ver el link.
 * Todo en colores planos a propósito: el PNG queda liviano, muy por debajo de
 * lo que WhatsApp acepta para mostrar la preview.
 */

export const alt = "Tiendify: crea tu tienda online y vende hoy";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// Ver el comentario de runtime en src/lib/og.ts antes de tocar esto.
export const runtime = "edge";
export const revalidate = 86400;

const NOCHE = "#0B1B2B";
const AZUL = "#0EA5E9";
const CUERPO = "#C9D5E3";

const TITULAR_1 = "Crea tu tienda online";
const TITULAR_2 = "y vende";
const TITULAR_ACENTO = "hoy.";
const BAJADA = `Gratis hasta ${FREE_MAX_PRODUCTS} productos. Precios en USD y Bs.`;
const PAGOS = ["Pago Móvil", "Zelle", "Binance", "Efectivo", "Tarjeta"];

export default async function Image() {
  const host = publicHost();

  const [titular, marca, pildoras, texto] = await Promise.all([
    loadGoogleFont("Inter", 900, `${TITULAR_1}${TITULAR_2}${TITULAR_ACENTO}`),
    loadGoogleFont("Figtree", 800, `Tiendify${host}`),
    loadGoogleFont("Figtree", 700, PAGOS.join("")),
    loadGoogleFont("Figtree", 500, BAJADA),
  ]);

  const fonts = [
    { name: "Inter", data: titular, weight: 900 as const },
    { name: "Figtree", data: marca, weight: 800 as const },
    { name: "Figtree", data: pildoras, weight: 700 as const },
    { name: "Figtree", data: texto, weight: 500 as const },
  ].flatMap((f) => (f.data ? [{ ...f, data: f.data, style: "normal" as const }] : []));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: NOCHE,
          fontFamily: "Figtree",
          color: "#FFFFFF",
        }}
      >
        {/* Logo: el mismo trazo de la etiqueta que public/tiendify-logo-white.svg */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="56" height="56" viewBox="14 18 42 42">
            <path
              d="M16 40 L36 20 H54 V38 L34 58 Z"
              fill="none"
              stroke={AZUL}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <circle cx="46" cy="29" r="4" fill={AZUL} />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            Tiend<span style={{ color: AZUL }}>ify</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter",
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -5,
            }}
          >
            <div style={{ display: "flex" }}>{TITULAR_1}</div>
            <div style={{ display: "flex" }}>
              {TITULAR_2}
              <span style={{ marginLeft: 18, color: AZUL }}>{TITULAR_ACENTO}</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 34,
              fontWeight: 500,
              color: CUERPO,
            }}
          >
            {BAJADA}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {PAGOS.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {p}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: AZUL }}>
            {host}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
