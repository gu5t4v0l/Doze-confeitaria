import { createHmac } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

const ISSUER = "doze-confeitaria";
const AUDIENCE = "admin";
export const MIN_SECRET_LENGTH = 32;

export interface SessionClaims {
  /** admin_users.id (claim `sub`). */
  userId: number;
  /** admin_users.session_version (claim `sv`): trocar senha / sair de todos incrementa e derruba as sessões. */
  sessionVersion: number;
}

function key(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error("SESSION_SECRET curto demais.");
  // chave derivada com rótulo próprio: o mesmo SESSION_SECRET não é usado cru aqui nem no hash de IP ("doze:ip-hash")
  return new Uint8Array(createHmac("sha256", secret).update("doze:session").digest());
}

const isPositiveInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

export async function createSessionToken(secret: string, claims: SessionClaims, now: Date = new Date()): Promise<string> {
  if (!isPositiveInt(claims.userId) || !isPositiveInt(claims.sessionVersion)) throw new Error("Sessão inválida.");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sv: claims.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(String(claims.userId))
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(key(secret));
}

/** Claims se assinatura, emissor, audiência e expiração conferem; senão null. (O banco ainda precisa confirmar `sv`.) */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    const userId = typeof payload.sub === "string" && /^[1-9]\d{0,9}$/.test(payload.sub) ? Number(payload.sub) : NaN;
    if (!isPositiveInt(userId) || !isPositiveInt(payload.sv)) return null;
    return { userId, sessionVersion: payload.sv };
  } catch {
    return null;
  }
}

/** SESSION_SECRET válido (>= 32 caracteres) ou null: sem ele NADA é liberado (falha segura). */
export function readSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}
