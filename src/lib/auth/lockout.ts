/** Regras puras do bloqueio progressivo de login. */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const IP_FAILURE_THRESHOLD = 5;
export const GLOBAL_FAILURE_THRESHOLD = 40;
/**
 * Limite POR CONTA (hash do e-mail): bem acima do limite por IP e com espera curta (30 s ... 5 min),
 * para que um atacante não consiga trancar a dona por muito tempo (DoS). Ver README.
 */
export const ACCOUNT_FAILURE_THRESHOLD = 10;
export const ACCOUNT_BACKOFF = { baseMs: 30_000, maxMs: 5 * 60 * 1000 } as const;
/** Troca de senha: senha atual errada 5 vezes em 15 min => espera progressiva. */
export const PASSWORD_FAILURE_THRESHOLD = 5;

export interface Backoff {
  baseMs?: number;
  maxMs?: number;
}

/**
 * Milissegundos que ainda faltam de espera, dado o histórico de falhas (epoch ms).
 * Depois de `threshold` falhas na janela: base, 2x, 4x... (padrão 1 min, 2, 4, 8... até 15 min) após a última falha.
 */
export function lockoutRemainingMs(
  failureTimes: number[],
  now: number,
  threshold: number,
  windowMs: number = LOCKOUT_WINDOW_MS,
  backoff: Backoff = {},
): number {
  const recent = failureTimes.filter((t) => t > now - windowMs);
  if (recent.length < threshold) return 0;
  const base = backoff.baseMs ?? 60_000;
  const max = backoff.maxMs ?? windowMs;
  const waitMs = Math.min(max, base * 2 ** (recent.length - threshold));
  const last = Math.max(...recent);
  return Math.max(0, last + waitMs - now);
}
