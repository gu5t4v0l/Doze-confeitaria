import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import {
  ACCOUNT_BACKOFF,
  ACCOUNT_FAILURE_THRESHOLD,
  GLOBAL_FAILURE_THRESHOLD,
  IP_FAILURE_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  PASSWORD_FAILURE_THRESHOLD,
  lockoutRemainingMs,
} from "@/lib/auth/lockout";
import { hashEmail } from "@/lib/auth/email";

type Scope = "login" | "password";

/** Hash do IP (nunca guardamos o IP em claro, nem a senha). */
export async function currentIpHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "desconhecido";
  return hashIp(ip, process.env.SESSION_SECRET ?? "");
}

/** HMAC-SHA256 do IP com chave derivada do segredo por rótulo próprio ("doze:ip-hash"), distinta da chave do JWT. */
export function hashIp(ip: string, secret: string): string {
  const ipKey = createHmac("sha256", secret).update("doze:ip-hash").digest();
  return createHmac("sha256", ipKey).update(ip).digest("hex").slice(0, 32);
}

/** Chave de limite da conta no login: HMAC do e-mail normalizado (existindo ou não: sem enumeração). */
export function loginAccountKey(email: string): string {
  return hashEmail(email, process.env.SESSION_SECRET ?? "");
}

/** Chave de limite da troca de senha: HMAC do id do usuário (rótulo próprio). */
export function passwordAccountKey(userId: number): string {
  return hashEmail(`user:${userId}`, process.env.SESSION_SECRET ?? "");
}

/** Milissegundos de espera restantes (0 = liberado). Só conta tentativas anteriores à própria (`id` menor). */
async function lockoutMs(scope: Scope, ipHash: string, accountHash: string, exceptId: number): Promise<number> {
  const sql = getDb();
  const windowSeconds = LOCKOUT_WINDOW_MS / 1000;
  const rows = await sql`select ip_hash, account_hash, (extract(epoch from created_at) * 1000)::float8 as t
    from login_attempts
    where success = false and scope = ${scope} and id < ${exceptId}
      and created_at > now() - make_interval(secs => ${windowSeconds})
    order by created_at desc limit 500`;
  const now = Date.now();
  const times = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).map((r) => Number(r.t));
  const waits = [lockoutRemainingMs(times((r) => r.ip_hash === ipHash), now, IP_FAILURE_THRESHOLD)];
  if (scope === "login") {
    waits.push(
      lockoutRemainingMs(
        times((r) => r.account_hash === accountHash),
        now,
        ACCOUNT_FAILURE_THRESHOLD,
        LOCKOUT_WINDOW_MS,
        ACCOUNT_BACKOFF,
      ),
      lockoutRemainingMs(times(() => true), now, GLOBAL_FAILURE_THRESHOLD),
    );
  } else {
    waits.push(lockoutRemainingMs(times((r) => r.account_hash === accountHash), now, PASSWORD_FAILURE_THRESHOLD));
  }
  return Math.max(...waits);
}

/**
 * Reserva uma tentativa ANTES de verificar a senha (evita a corrida em que requisições paralelas
 * passam todas pelo limite enquanto o scrypt roda). Grava a tentativa como falha e só depois
 * confere o bloqueio contando as falhas anteriores: a n-ésima requisição paralela (por id) conta as n-1
 * já gravadas, então só as primeiras passam. Se estiver bloqueado, a linha é apagada (tentativas
 * durante o bloqueio não contam, para um IP não disparar o bloqueio global nem prolongar a espera da conta).
 * Devolve 0 se a tentativa foi reservada, ou os ms de espera.
 */
async function reserve(scope: Scope, ipHash: string, accountHash: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`insert into login_attempts (ip_hash, account_hash, scope, success)
    values (${ipHash}, ${accountHash}, ${scope}, false) returning id`;
  const id = rows[0].id; // bigserial: o driver pode devolver string
  const waitMs = await lockoutMs(scope, ipHash, accountHash, id);
  if (waitMs > 0) {
    await sql`delete from login_attempts where id = ${id}`;
    return waitMs;
  }
  return 0;
}

/** Login: limites por IP (5), por conta (10, espera curta) e global (40). */
export function reserveLoginAttempt(ipHash: string, accountHash: string): Promise<number> {
  return reserve("login", ipHash, accountHash);
}

/** Troca de senha: tentativas erradas da senha atual, por usuário e por IP (5 em 15 min). */
export function reservePasswordAttempt(ipHash: string, accountHash: string): Promise<number> {
  return reserve("password", ipHash, accountHash);
}

/** Senha correta: limpa as falhas daquele IP e daquela conta (inclusive a tentativa reservada). */
export async function clearFailures(scope: Scope, ipHash: string, accountHash: string): Promise<void> {
  const sql = getDb();
  await sql`delete from login_attempts where scope = ${scope} and success = false and (ip_hash = ${ipHash} or account_hash = ${accountHash})`;
  // limpeza oportunista de registros com mais de 2 dias
  await sql`delete from login_attempts where created_at < now() - interval '2 days'`;
}
