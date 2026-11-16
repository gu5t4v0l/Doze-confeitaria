import { createHash, createHmac } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

const ISSUER = "doze-confeitaria";
const AUDIENCE = "admin";
export const MIN_SECRET_LENGTH = 32;

export interface SessionContext {
  /** SESSION_SECRET (>= 32 caracteres). */
  secret: string;
  /** ADMIN_PASSWORD_HASH atual: trocar a senha derruba as sessões antigas. */
  passwordHash: string;
}

function key(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error("SESSION_SECRET curto demais.");
  // chave derivada com rótulo próprio: o mesmo SESSION_SECRET não é usado cru aqui nem no hash de IP ("doze:ip-hash")
  return new Uint8Array(createHmac("sha256", secret).update("doze:session").digest());
}

/** Impressão digital do hash da senha (não revela o hash). */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export async function createSessionToken(ctx: SessionContext, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ pwv: passwordFingerprint(ctx.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject("admin")
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(key(ctx.secret));
}

/** true somente se assinatura, emissor, expiração e versão da senha conferem. */
export async function verifySessionToken(
  token: string | undefined,
  ctx: SessionContext,
  now: Date = new Date(),
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(ctx.secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: "admin",
      currentDate: now,
    });
    return payload.pwv === passwordFingerprint(ctx.passwordHash);
  } catch {
    return false;
  }
}

/** Lê as variáveis de ambiente; null se o painel não estiver configurado. */
export function readSessionContext(): SessionContext | null {
  const secret = process.env.SESSION_SECRET ?? "";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (secret.length < MIN_SECRET_LENGTH || !passwordHash) return null;
  return { secret, passwordHash };
}
