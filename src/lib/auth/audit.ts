import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { currentIpHash } from "@/lib/auth/rate-limit";

export const AUDIT_EVENTS = [
  "login_success",
  "login_failure",
  "logout",
  "password_changed",
  "sessions_revoked",
  "user_created",
  "password_reset_cli",
] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const AUDIT_RETENTION_DAYS = 90;
const MAX_UA = 120;

export interface AuditEntry {
  event: AuditEvent;
  userId?: number | null;
  /** HMAC do e-mail digitado (só para tentativas de usuário inexistente; nunca o e-mail em claro). */
  subjectHash?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

/** User-agent sem caracteres de controle e com no máximo 120 caracteres. */
export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  // eslint-disable-next-line no-control-regex
  const clean = ua.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_UA);
  return clean || null;
}

/** Grava a auditoria. Melhor esforço: falha de auditoria é logada (sem dados) e não derruba o fluxo. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const sql = getDb();
    await sql`insert into admin_audit (user_id, event, ip_hash, subject_hash, user_agent)
      values (${entry.userId ?? null}, ${entry.event}, ${entry.ipHash ?? null}, ${entry.subjectHash ?? null}, ${truncateUserAgent(entry.userAgent)})`;
    if (Math.random() < 0.05) await purgeOldAudit(); // limpeza oportunista
  } catch {
    console.error("[audit] não foi possível gravar o evento", entry.event);
  }
}

export async function purgeOldAudit(): Promise<void> {
  const sql = getDb();
  await sql`delete from admin_audit where created_at < now() - make_interval(days => ${AUDIT_RETENTION_DAYS})`;
}

/** IP em HMAC + user-agent truncado da requisição atual. */
export async function requestMeta(): Promise<{ ipHash: string; userAgent: string | null }> {
  const h = await headers();
  return { ipHash: await currentIpHash(), userAgent: truncateUserAgent(h.get("user-agent")) };
}
