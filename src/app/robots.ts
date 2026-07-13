import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://tiendifyapp.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/panel",
          "/super",
          "/api",
          "/auth",
          "/login",
          "/recuperar",
          "/actualizar-clave",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
