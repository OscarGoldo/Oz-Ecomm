import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/panel", "/super"];

export async function middleware(request: NextRequest) {
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
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
