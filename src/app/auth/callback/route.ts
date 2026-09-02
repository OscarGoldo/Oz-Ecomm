import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Ruta de destino segura a partir del `?next=` de la URL.
 *
 * Antes se concatenaba `${origin}${next}` sin mirar qué traía. Con
 * `next=@evil.com` la cadena queda `https://tiendifyapp.com@evil.com`, que el
 * parser de URL lee como usuario `tiendifyapp.com` en el host `evil.com`: un
 * open redirect con TU dominio al principio del enlace, que es justo lo que
 * hace creíble un phishing contra tus comerciantes.
 *
 * Solo se acepta una ruta interna: empieza con `/` y no con `//` (que el
 * navegador interpreta como protocolo relativo y también se va afuera).
 */
function safeNext(raw: string | null): string {
  const fallback = "/panel";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // `\` lo normalizan algunos navegadores a `/`, así que `/\evil.com` también
  // se escapa del origen.
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}

/**
 * Magic-link landing. Supabase redirects here with `?code=...` after the user
 * clicks the email link; we exchange it for a session cookie, then forward to
 * `next` (the panel by default).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
