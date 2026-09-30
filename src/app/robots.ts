import type { MetadataRoute } from "next";

import { publicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
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
