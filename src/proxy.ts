import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-config";
import { readSessionSecret, verifySessionToken } from "@/lib/auth/session-token";

/**
 * Primeira barreira para /admin/*: só confere o JWT (assinatura/expiração), sem banco.
 * NÃO é a única: páginas, Server Actions e route handlers do admin reverificam no servidor
 * (requireAdmin(): JWT + consulta ao banco: usuário ativo e session_version atual).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  if (pathname === "/admin/sessao-encerrada") return NextResponse.next(); // apaga o cookie de sessão revogada
  const secret = readSessionSecret();
  const claims = secret ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  const valid = claims !== null;

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
