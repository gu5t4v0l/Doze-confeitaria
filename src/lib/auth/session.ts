import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, IS_PROD } from "@/lib/auth/session-config";
import { createSessionToken, readSessionContext, verifySessionToken } from "@/lib/auth/session-token";

export async function startAdminSession(): Promise<void> {
  const ctx = readSessionContext();
  if (!ctx) throw new Error("Painel não configurado.");
  const token = await createSessionToken(ctx);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Sessão válida? (assinatura + expiração + versão da senha) */
export async function isAdmin(): Promise<boolean> {
  const ctx = readSessionContext();
  if (!ctx) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, ctx);
}

/**
 * Autorização DENTRO de cada página, Server Action e route handler do admin.
 * O proxy é só a primeira barreira: nunca confie apenas nele.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
