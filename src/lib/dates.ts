import { formatDateBR } from "@/lib/format";

/** Fuso fixo da confeitaria: o "hoje" nunca depende do relógio/fuso do aparelho. */
export const STORE_TIME_ZONE = "America/Sao_Paulo";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface OrderRules {
  /** Último dia para fazer pedidos (inclusive). null = sem limite. */
  orderDeadline: string | null;
  /** Última data de entrega/retirada. null = sem limite. */
  lastDeliveryDate: string | null;
  minLeadDays: number;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Hoje" em America/Sao_Paulo, como "AAAA-MM-DD". */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

/** "AAAA-MM-DD" estrito (e existente no calendário) -> partes, ou null. */
export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = ISO_RE.exec(iso);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

export function isValidISODate(iso: string): boolean {
  return parseISODate(iso) !== null;
}

/** Soma dias a uma data ISO usando só aritmética UTC (sem fuso/horário de verão). */
export function addDaysISO(iso: string, days: number): string {
  const p = parseISODate(iso);
  if (!p) throw new Error(`Data inválida: ${iso}`);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  const y = String(t.getUTCFullYear()).padStart(4, "0");
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Pedidos encerrados: hoje já passou da data limite de pedidos. */
export function isOrdersClosed(todayISO: string, rules: OrderRules): boolean {
  return rules.orderDeadline !== null && todayISO > rules.orderDeadline;
}

export function getDateBounds(todayISO: string, rules: OrderRules) {
  return {
    min: addDaysISO(todayISO, rules.minLeadDays),
    max: rules.lastDeliveryDate,
  };
}

/** Retorna a mensagem de erro (pt-BR) ou null se a data é válida/vazia. */
export function validateDesiredDate(
  iso: string,
  todayISO: string,
  rules: OrderRules,
): string | null {
  if (!iso) return null;
  if (!parseISODate(iso)) return "Informe uma data válida.";
  const { min, max } = getDateBounds(todayISO, rules);
  if (max !== null && min > max) {
    return `O período de encomendas terminou (entregas até ${formatDateBR(max)}).`;
  }
  if (iso < min) {
    return `Prazo mínimo de ${rules.minLeadDays} dias: escolha a partir de ${formatDateBR(min)}.`;
  }
  if (max !== null && iso > max) {
    return `Entregas e retiradas somente até ${formatDateBR(max)}.`;
  }
  return null;
}
