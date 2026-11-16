import { NextResponse, type NextRequest } from "next/server";
import { IS_PROD, SESSION_COOKIE } from "@/lib/auth/session-config";

/**
 * Sessão revogada (trocou a senha / "sair de todos") ou conta desativada: apaga o cookie
 * e manda para o login. Existe para o proxy (que só vê o JWT) não ficar num laço de redirecionamentos.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
