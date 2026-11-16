/** Regras puras do bloqueio progressivo de login. */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const IP_FAILURE_THRESHOLD = 5;
export const GLOBAL_FAILURE_THRESHOLD = 40;

/**
 * Milissegundos que ainda faltam de espera, dado o histórico de falhas (epoch ms).
 * Depois de `threshold` falhas na janela: 1 min, 2, 4, 8... até 15 min após a última falha.
 */
export function lockoutRemainingMs(
  failureTimes: number[],
  now: number,
  threshold: number,
  windowMs: number = LOCKOUT_WINDOW_MS,
): number {
  const recent = failureTimes.filter((t) => t > now - windowMs);
  if (recent.length < threshold) return 0;
  const waitMs = Math.min(windowMs, 60_000 * 2 ** (recent.length - threshold));
  const last = Math.max(...recent);
  return Math.max(0, last + waitMs - now);
}
