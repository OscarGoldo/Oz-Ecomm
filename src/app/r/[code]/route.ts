import { NextResponse, type NextRequest } from "next/server";

import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_FIELD,
  normalizeReferralCode,
} from "@/lib/referrals";

/**
 * `/r/<codigo>` — el link que comparte el comerciante.
 *
 * Deja la cookie y manda a crear la tienda. Va por cookie y no solo por query
 * porque el que llega casi siempre da una vuelta antes de registrarse (mira la
 * landing, cierra, vuelve al otro día): sin la cookie, el que lo trajo pierde
 * el crédito. El código viaja también en la URL por si el navegador bloquea
 * cookies de entrada.
 */
export function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = normalizeReferralCode(params.code);

  const url = request.nextUrl.clone();
  url.pathname = "/crear-tienda";
  url.search = code ? `?${REFERRAL_FIELD}=${code}` : "";

  const response = NextResponse.redirect(url);
  if (code) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return response;
}
