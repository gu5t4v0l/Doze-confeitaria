import { createHmac } from "node:crypto";

export const MAX_EMAIL_LENGTH = 254;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Identificador de login: minúsculo, sem espaços nas pontas, NFKC. */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFKC").trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH + 1);
}

export function isValidEmail(email: string): boolean {
  return email.length >= 5 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

/**
 * HMAC do e-mail com chave derivada por rótulo próprio ("doze:email-hash"):
 * usado no limite por conta e na auditoria (nunca o e-mail em claro de quem não existe).
 */
export function hashEmail(email: string, secret: string): string {
  const key = createHmac("sha256", secret).update("doze:email-hash").digest();
  return createHmac("sha256", key).update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

/** Para logs: nunca o e-mail completo. "maria@x.com" -> "m***@x.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}
