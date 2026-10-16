import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { publicSiteUrl } from "@/lib/site-url";
import { STORE_PATH_HEADER, storeSlugFromHost } from "@/lib/store-url";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/panel", "/super"];

/**
 * Las rutas que existen dentro de una tienda (src/app/(public)/[store_slug]).
 * En un subdominio solo estas se sirven; todo lo demás (panel, login, legales)
 * vive en el dominio de la plataforma.
 */
const STORE_ROUTES = ["/carrito", "/checkout", "/pedido", "/producto"];

function isStoreRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    STORE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * mitienda.usatiendify.com/producto/x → ruta interna /mitienda/producto/x.
 *
 * Acá no se refresca la sesión de Supabase: en la tienda nadie inicia sesión, y
 * la cookie de sesión es del dominio de la plataforma, así que ni siquiera
 * llega. Si la tienda no existe o no es Pro, lo resuelve el layout de la
 * tienda, que ya consulta la base: hacerlo acá sería una consulta más en cada
 * visita.
 */
function storeHostResponse(request: NextRequest, slug: string): NextResponse {
  const { pathname, search } = request.nextUrl;

  // Un enlace con el formato viejo (/mitienda/...) abierto en el subdominio.
  // Se arma con el host de la petición: el subdominio es lo que el cliente pidió.
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    const url = request.nextUrl.clone();
    url.host = request.headers.get("host") ?? url.host;
    url.pathname = pathname.slice(slug.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (!isStoreRoute(pathname)) {
    return NextResponse.redirect(`${publicSiteUrl()}${pathname}${search}`, 307);
  }

  const headers = new Headers(request.headers);
  headers.set(STORE_PATH_HEADER, `${pathname}${search}`);

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export async function middleware(request: NextRequest) {
  const storeSlug = storeSlugFromHost(request.headers.get("host"));
  if (storeSlug) return storeHostResponse(request, storeSlug);

  // Always refresh the Supabase session so Server Components see a fresh token.
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Role-based authorization (owner vs super_admin) and store resolution are
  // handled in the route layouts, which can query the DB. Middleware only
  // enforces "must be signed in" + refreshes the session.
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon and common static asset extensions
     * - opengraph-image: lo piden los crawlers (WhatsApp, Instagram), que nunca
     *   traen sesión. Refrescar el token de Supabase ahí es una llamada tirada.
     *   La imagen de una tienda se pide siempre en el dominio de la plataforma
     *   (metadataBase), así que tampoco hace falta reescribirla.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*opengraph-image.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
