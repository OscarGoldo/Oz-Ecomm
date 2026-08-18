/** @type {import('next').NextConfig} */
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  // Habilita src/instrumentation.ts, que arranca el monitoreo de errores del
  // servidor. En Next 14 todavía vive detrás de esta bandera.
  experimental: {
    instrumentationHook: true,
    // El SDK de Node de Sentry carga OpenTelemetry con `require` dinámico, que
    // webpack no puede trazar (avisa "Critical dependency"). Se resuelve
    // dejándolo fuera del bundle en vez de silenciar el warning: Node lo
    // resuelve en runtime desde node_modules, como corresponde.
    serverComponentsExternalPackages: ["@sentry/nextjs", "@sentry/node"],
  },
  images: {
    remotePatterns: [
      // Supabase Storage (logos, banners, product images, payment proofs)
      ...(supabaseHostname
        ? [{ protocol: "https", hostname: supabaseHostname }]
        : []),
      // Placeholder images used in the Alfa Electronic seed
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
