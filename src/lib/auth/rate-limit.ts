import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import {
  GLOBAL_FAILURE_THRESHOLD,
  IP_FAILURE_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  lockoutRemainingMs,
} from "@/lib/auth/lockout";

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

/** Milissegundos de espera restantes (0 = liberado). só conta tentativas anteriores à própria (`id` menor). */
async function lockoutMs(ipHash: string, exceptId: number): Promise<number> {
  const sql = getDb();
  const windowSeconds = LOCKOUT_WINDOW_MS / 1000;
  const [ipRows, globalRows] = await Promise.all([
    sql`select (extract(epoch from created_at) * 1000)::float8 as t from login_attempts
        where success = false and ip_hash = ${ipHash} and id < ${exceptId}
          and created_at > now() - make_interval(secs => ${windowSeconds})`,
    sql`select (extract(epoch from created_at) * 1000)::float8 as t from login_attempts
        where success = false and id < ${exceptId}
          and created_at > now() - make_interval(secs => ${windowSeconds})
        order by created_at desc limit 200`,
  ]);
  const now = Date.now();
  return Math.max(
    lockoutRemainingMs(ipRows.map((r) => Number(r.t)), now, IP_FAILURE_THRESHOLD),
    lockoutRemainingMs(globalRows.map((r) => Number(r.t)), now, GLOBAL_FAILURE_THRESHOLD),
  );
}

/**
 * Reserva uma tentativa ANTES de verificar a senha (evita a corrida em que requisições paralelas
 * passam todas pelo limite enquanto o scrypt roda). Grava a tentativa como falha e só depois
 * confere o bloqueio contando as falhas anteriores: a n-ésima requisição paralela (por id) conta as n-1
 * já gravadas, então só as 5 primeiras passam. Se estiver bloqueado, a linha é apagada (tentativas
 * durante o bloqueio não contam, para um IP não disparar o bloqueio global). Devolve 0 se a
 * tentativa foi reservada, ou os ms de espera.
 */
export async function reserveLoginAttempt(ipHash: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`insert into login_attempts (ip_hash, success) values (${ipHash}, false) returning id`;
  const id = rows[0].id; // bigserial: o driver pode devolver string
  const waitMs = await lockoutMs(ipHash, id);
  if (waitMs > 0) {
    await sql`delete from login_attempts where id = ${id}`;
    return waitMs;
  }
  return 0;
}

/** Senha correta: limpa as falhas daquele IP (inclusive a tentativa reservada). */
export async function clearFailures(ipHash: string): Promise<void> {
  const sql = getDb();
  await sql`delete from login_attempts where ip_hash = ${ipHash} and success = false`;
  // limpeza oportunista de registros com mais de 2 dias
  await sql`delete from login_attempts where created_at < now() - interval '2 days'`;
}
