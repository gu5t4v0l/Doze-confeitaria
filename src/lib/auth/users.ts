import "server-only";
import { getDb } from "@/lib/db/client";
import { normalizeEmail } from "@/lib/auth/email";

/**
 * ÚNICO módulo que toca `admin_users`. Regras:
 * - sem `select *` / `returning *`: colunas sempre explícitas;
 * - `password_hash` só sai em DUAS consultas (findLoginCandidate e getPasswordHash), usadas só para verificar;
 * - tudo o que vai para páginas/Server Actions é DTO sem hash.
 */

export interface AdminUserDto {
  id: number;
  email: string;
  displayName: string;
  active: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

export interface SessionState {
  id: number;
  active: boolean;
  sessionVersion: number;
}

export interface LoginCandidate {
  id: number;
  passwordHash: string;
  active: boolean;
  sessionVersion: number;
}

const iso = (ms: unknown): string | null =>
  ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString();

/** Consulta de verificação do login (devolve o hash: NÃO repasse o resultado adiante). */
export async function findLoginCandidate(email: string): Promise<LoginCandidate | null> {
  const sql = getDb();
  const rows = await sql`select id, password_hash, active, session_version from admin_users where email = ${normalizeEmail(email)}`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    passwordHash: String(r.password_hash),
    active: Boolean(r.active),
    sessionVersion: Number(r.session_version),
  };
}

/** Consulta de verificação da senha atual (troca de senha). */
export async function getPasswordHash(userId: number): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`select password_hash from admin_users where id = ${userId} and active = true`;
  return rows[0] ? String(rows[0].password_hash) : null;
}

/** Consulta leve da sessão: só id, active, session_version. */
export async function getSessionState(userId: number): Promise<SessionState | null> {
  const sql = getDb();
  const rows = await sql`select id, active, session_version from admin_users where id = ${userId}`;
  const r = rows[0];
  return r ? { id: Number(r.id), active: Boolean(r.active), sessionVersion: Number(r.session_version) } : null;
}

export async function getUserDto(userId: number): Promise<AdminUserDto | null> {
  const sql = getDb();
  const rows = await sql`select id, email, display_name, active,
      (extract(epoch from last_login_at) * 1000)::float8 as last_login_ms,
      (extract(epoch from password_changed_at) * 1000)::float8 as password_changed_ms
    from admin_users where id = ${userId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    email: String(r.email),
    displayName: String(r.display_name),
    active: Boolean(r.active),
    lastLoginAt: iso(r.last_login_ms),
    passwordChangedAt: iso(r.password_changed_ms),
  };
}

export async function recordLogin(userId: number): Promise<void> {
  const sql = getDb();
  await sql`update admin_users set last_login_at = now() where id = ${userId}`;
}

/**
 * Troca o hash SE o hash atual ainda é o verificado (evita corrida) e incrementa session_version
 * (derruba todas as outras sessões). Devolve a nova versão, ou null se a senha mudou no meio do caminho.
 */
export async function changePassword(userId: number, expectedOldHash: string, newHash: string): Promise<number | null> {
  const sql = getDb();
  const rows = await sql`update admin_users
    set password_hash = ${newHash}, session_version = session_version + 1,
        password_changed_at = now(), updated_at = now()
    where id = ${userId} and active = true and password_hash = ${expectedOldHash}
    returning session_version`;
  return rows[0] ? Number(rows[0].session_version) : null;
}

/** Derruba todas as sessões (inclusive a atual). */
export async function revokeSessions(userId: number): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`update admin_users set session_version = session_version + 1, updated_at = now()
    where id = ${userId} returning id`;
  return rows.length > 0;
}

/** Usado só pelo script admin:create. Devolve null se o e-mail já existe. */
export async function createUser(email: string, displayName: string, passwordHash: string): Promise<AdminUserDto | null> {
  const sql = getDb();
  const rows = await sql`insert into admin_users (email, display_name, password_hash)
    values (${normalizeEmail(email)}, ${displayName.trim().slice(0, 80)}, ${passwordHash})
    on conflict (email) do nothing returning id`;
  return rows[0] ? getUserDto(Number(rows[0].id)) : null;
}

/** Usado só pelo script admin:reset: nova senha + invalida sessões. Devolve o id, ou null se o e-mail não existe. */
export async function resetPassword(email: string, passwordHash: string): Promise<number | null> {
  const sql = getDb();
  const rows = await sql`update admin_users
    set password_hash = ${passwordHash}, session_version = session_version + 1,
        password_changed_at = now(), updated_at = now()
    where email = ${normalizeEmail(email)} returning id`;
  return rows[0] ? Number(rows[0].id) : null;
}
