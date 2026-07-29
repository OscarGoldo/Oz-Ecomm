/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- satori solo
   entiende <img>; next/image no existe en el render de la tarjeta. */
import { ImageResponse } from "next/og";

import { isDarkColor } from "@/lib/color";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  eq,
  initialOf,
  loadOgImage,
  publicHost,
  restCount,
  restGet,
  safeColor,
  truncate,
} from "@/lib/og";
import type { Store } from "@/types/database";

/**
 * La tarjeta del home de la tienda. Es el link que más se comparte por WhatsApp
 * ("mira mi tienda"), así que va con el mismo cuidado que la del producto.
 *
 * El banner ocupa solo una franja arriba, no el fondo entero, a propósito: el
 * PNG que sale de aquí se llena de color plano, que pesa casi nada, y así la
 * imagen entra cómoda bajo el límite que WhatsApp acepta para las previews.
 */

export const alt = "Tienda en Tiendify";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
// Ver el comentario de runtime en src/lib/og.ts antes de tocar esto.
export const runtime = "edge";
export const revalidate = 3600;

type StoreCard = Pick<
  Store,
  "id" | "name" | "slug" | "description" | "logo_url" | "banner_url" | "primary_color"
>;

/** Franja del banner. Cuanto más alta, más pesa el PNG (ver src/lib/og.ts). */
const BAND_H = 200;

const INK = "#0F172A";
const MUTED = "#64748B";
const FAINT = "#94A3B8";

export default async function Image({
  params,
}: {
  params: { store_slug: string };
}) {
  const [store] = await restGet<StoreCard>(
    `stores?slug=eq.${eq(params.store_slug)}&active=is.true` +
      `&select=id,name,slug,description,logo_url,banner_url,primary_color&limit=1`,
  );

  if (!store) {
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

  const products = await restCount(
    `products?store_id=eq.${eq(store.id)}&status=eq.active&select=id`,
  );

  const brand = safeColor(store.primary_color);
  const onBrand = isDarkColor(brand) ? "#FFFFFF" : INK;

  const banner = await loadOgImage(store.banner_url, {
    w: OG_SIZE.width,
    h: BAND_H,
  });
  const logo = await loadOgImage(store.logo_url, { w: 224, h: 224 });

  const productLine =
    products === 0
      ? "Catálogo online"
      : `${products} ${products === 1 ? "producto" : "productos"} en catálogo`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Franja superior: banner de la tienda, o su color de marca */}
        <div
          style={{
            width: "100%",
            height: BAND_H,
            display: "flex",
            background: brand,
          }}
        >
          {banner && (
            <img
              src={banner}
              width={OG_SIZE.width}
              height={BAND_H}
              style={{ objectFit: "cover" }}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "0 64px",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {logo ? (
              <img
                src={logo}
                width={112}
                height={112}
                style={{ borderRadius: 56, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 112,
                  height: 112,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 56,
                  background: brand,
                  color: onBrand,
                  fontSize: 56,
                  fontWeight: 700,
                }}
              >
                {initialOf(store.name)}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 60,
                  fontWeight: 800,
                  color: INK,
                  lineHeight: 1.1,
                }}
              >
                {truncate(store.name, 30)}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontSize: 28,
                  fontWeight: 600,
                  color: MUTED,
                }}
              >
                {productLine}
              </div>
            </div>
          </div>

          {store.description && (
            <div
              style={{
                display: "flex",
                marginTop: 30,
                fontSize: 30,
                color: MUTED,
                lineHeight: 1.35,
              }}
            >
              {truncate(store.description, 110)}
            </div>
          )}

          <div
            style={{ display: "flex", marginTop: 34, fontSize: 26, color: FAINT }}
          >
            {publicHost()}/{store.slug}
          </div>
        </div>

        {/* Misma franja de marca que la tarjeta de producto */}
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
