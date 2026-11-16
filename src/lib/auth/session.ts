import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, IS_PROD } from "@/lib/auth/session-config";
import { createSessionToken, readSessionSecret, verifySessionToken, type SessionClaims } from "@/lib/auth/session-token";
import { getSessionState } from "@/lib/auth/users";

export interface AdminSession {
  userId: number;
  sessionVersion: number;
}

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax",
  path: "/",
} as const;

export async function startAdminSession(userId: number, sessionVersion: number): Promise<void> {
  const secret = readSessionSecret();
  if (!secret) throw new Error("Painel não configurado.");
  const token = await createSessionToken(secret, { userId, sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, { ...COOKIE_BASE, maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}

/** JWT válido (assinatura/expiração) do cookie atual, sem consultar o banco. */
export async function readSessionClaims(): Promise<SessionClaims | null> {
  const secret = readSessionSecret();
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, secret);
}

/**
 * Confere no banco (1 consulta leve: id, active, session_version). Memoizado por requisição E por
 * versão reivindicada: depois de trocar a senha (nova versão) a mesma requisição não reaproveita a antiga.
 * Banco fora do ar => false (NEGA, nunca libera).
 */
const sessionStillValid = cache(async (userId: number, claimedVersion: number): Promise<boolean> => {
  try {
    const state = await getSessionState(userId);
    return state !== null && state.active && state.sessionVersion === claimedVersion;
  } catch {
    console.error("[admin] não foi possível validar a sessão no banco.");
    return false;
  }
});

/** Sessão completa: JWT + usuário existe, está ativo e a versão da sessão é a atual. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const claims = await readSessionClaims();
  if (!claims) return null;
  return (await sessionStillValid(claims.userId, claims.sessionVersion)) ? claims : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/**
 * Autorização DENTRO de cada página, Server Action e route handler do admin.
 * O proxy é só a primeira barreira: nunca confie apenas nele.
 * JWT válido mas revogado/inativo => passa pela rota que apaga o cookie (evita laço com o proxy).
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) return session;
  redirect((await readSessionClaims()) ? "/admin/sessao-encerrada" : "/admin/login");
}
