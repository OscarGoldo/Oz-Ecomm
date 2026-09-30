/**
 * La URL pública canónica del sitio, para todo lo que leen los rastreadores:
 * og:image, canonical, sitemap, robots y datos estructurados.
 *
 * El dominio canónico es el SIN www: www.tiendifyapp.com responde un 308 hacia
 * él. El navegador sigue ese salto sin que se note, pero un rastreador no
 * siempre — el de WhatsApp pide la foto de la vista previa y, si le contestan
 * con una redirección, puede quedarse sin foto —, y Google recibe un canonical
 * que apunta a una URL que redirige. La variable de producción está con www,
 * así que se normaliza acá.
 *
 * Solo para lo público. Los enlaces de login y recuperación de clave siguen
 * usando NEXT_PUBLIC_APP_URL tal cual: dependen de las URLs permitidas en
 * Supabase Auth, y cambiarlos sin tocar esa lista rompería "olvidé mi clave".
 */
export function publicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "https://tiendifyapp.com";
  return raw.replace(/\/+$/, "").replace(/^(https?:\/\/)www\./i, "$1");
}
