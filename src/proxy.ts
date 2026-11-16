import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-config";
import { readSessionContext, verifySessionToken } from "@/lib/auth/session-token";

/**
 * Primeira barreira para /admin/*. NÃO é a única: páginas, Server Actions e
 * route handlers do admin reverificam a sessão no servidor (requireAdmin()).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const ctx = readSessionContext();
  const valid = ctx ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, ctx) : false;

  if (!valid && !isLogin) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (valid && isLogin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
