/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- satori solo
   entiende <img>; next/image no existe en el render de la tarjeta. */
import { ImageResponse } from "next/og";

import { isDarkColor } from "@/lib/color";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  eq,
  initialOf,
  loadOgImage,
  publicHost,
  restGet,
  safeColor,
  truncate,
} from "@/lib/og";
import type { Product, Store } from "@/types/database";

/**
 * La tarjeta que se ve cuando alguien pega el link de un producto en WhatsApp.
 * Foto + nombre + precio, que es exactamente lo que decide si el otro toca el
 * link o lo pasa de largo.
 */

export const alt = "Producto en Tiendify";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// Ver el comentario de runtime en src/lib/og.ts antes de tocar esto.
export const runtime = "edge";
// Sin cookies en la lectura, así que el segmento cachea: el crawler de WhatsApp
// reusa la imagen en vez de hacerla generar de nuevo en cada visita.
export const revalidate = 3600;

type StoreCard = Pick<
  Store,
  "id" | "name" | "slug" | "logo_url" | "primary_color" | "exchange_rate" | "show_bs_prices"
>;
type ProductCard = Pick<
  Product,
  "name" | "price" | "compare_at_price" | "images" | "stock" | "track_stock"
>;

/**
 * Panel izquierdo, y el cuadro de la foto dentro de él.
 *
 * La foto va en un cuadro con aire alrededor, no a sangre: el PNG que sale de
 * aquí es sin pérdida, así que el peso lo manda la cantidad de píxeles
 * fotográficos. Menos foto y más color plano = preview que WhatsApp sí baja
 * (corta arriba de ~600 KB). Medido: a sangre daba 887 KB en la foto más
 * detallada del catálogo; así queda en un tercio de eso.
 */
const PANEL_W = 520;
const PHOTO = { w: 420, h: 420 };

const INK = "#0F172A";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const SOFT_BG = "#F1F5F9";

export default async function Image({
  params,
}: {
  params: { store_slug: string; product_slug: string };
}) {
  const [store] = await restGet<StoreCard>(
    `stores?slug=eq.${eq(params.store_slug)}&active=is.true` +
      `&select=id,name,slug,logo_url,primary_color,exchange_rate,show_bs_prices&limit=1`,
  );

  const [product] = store
    ? await restGet<ProductCard>(
        `products?store_id=eq.${eq(store.id)}&slug=eq.${eq(params.product_slug)}` +
          `&status=eq.active` +
          `&select=name,price,compare_at_price,images,stock,track_stock&limit=1`,
      )
    : [];

  // Tienda o producto que no existe: tarjeta neutra en vez de un 500. La página
  // igual va a devolver 404, pero el crawler no se queda sin imagen.
  if (!store || !product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: INK,
            color: "#FFFFFF",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          Tiendify
        </div>
      ),
      { ...OG_SIZE },
    );
  }

  const brand = safeColor(store.primary_color);
  const onBrand = isDarkColor(brand) ? "#FFFFFF" : INK;

  const photo = await loadOgImage(product.images?.[0], PHOTO);
  const logo = await loadOgImage(store.logo_url, { w: 88, h: 88 });

  const bs = store.show_bs_prices
    ? usdToBs(product.price, store.exchange_rate)
    : null;
  const hasDiscount =
    product.compare_at_price != null && product.compare_at_price > product.price;
  const soldOut = product.track_stock && product.stock <= 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Foto del producto — o su reemplazo si el formato no se puede dibujar */}
        <div
          style={{
            width: PANEL_W,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SOFT_BG,
          }}
        >
          {photo ? (
            <img
              src={photo}
              width={PHOTO.w}
              height={PHOTO.h}
              style={{ objectFit: "cover", borderRadius: 28 }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 100,
                background: brand,
                color: onBrand,
                fontSize: 96,
                fontWeight: 700,
              }}
            >
              {initialOf(store.name)}
            </div>
          )}
        </div>

        {/* Panel de texto */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logo && (
              <img
                src={logo}
                width={44}
                height={44}
                style={{ borderRadius: 22, objectFit: "cover" }}
              />
            )}
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                color: MUTED,
              }}
            >
              {truncate(store.name, 26)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 52,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.15,
            }}
          >
            {truncate(product.name, 58)}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 18,
              marginTop: 28,
            }}
          >
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: INK }}>
              {formatUSD(product.price)}
            </div>
            {hasDiscount && (
              <div
                style={{
                  display: "flex",
                  fontSize: 32,
                  color: FAINT,
                  textDecoration: "line-through",
                }}
              >
                {formatUSD(product.compare_at_price!)}
              </div>
            )}
          </div>

          {bs !== null && (
            <div
              style={{ display: "flex", marginTop: 8, fontSize: 30, color: MUTED }}
            >
              {formatBs(bs)}
            </div>
          )}

          {soldOut && (
            <div
              style={{
                display: "flex",
                marginTop: 26,
                padding: "8px 20px",
                borderRadius: 999,
                background: SOFT_BG,
                color: MUTED,
                fontSize: 26,
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              Agotado
            </div>
          )}

          <div
            style={{ display: "flex", marginTop: 34, fontSize: 24, color: FAINT }}
          >
            {publicHost()}/{store.slug}
          </div>
        </div>

        {/* Franja con el color de la tienda */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 12,
            background: brand,
          }}
        />
      </div>
    ),
    { ...OG_SIZE },
  );
}
