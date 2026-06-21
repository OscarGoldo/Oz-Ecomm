/** @type {import('next').NextConfig} */
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
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
