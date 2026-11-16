/** Utilitários de dinheiro: tudo em centavos inteiros. */

export const MAX_PRICE_CENTS = 1_000_000; // R$ 10.000,00

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123450 -> "R$ 1.234,50" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Sem centavos quando inteiro: 4900 -> "R$ 49"; senão "R$ 49,50". */
export function formatBRLCompact(cents: number): string {
  return cents % 100 === 0 ? brl.format(cents / 100).replace(/,00$/, "") : brl.format(cents / 100);
}

/** Versão com espaço comum (sem NBSP), segura para mensagens de texto. */
export function formatBRLPlain(cents: number): string {
  return formatBRL(cents).replace(/[\u00a0\u202f]/g, " ");
}

/**
 * Converte o texto digitado ("19", "19,5", "1.234,56", "R$ 19,00") em centavos.
 * Retorna null se não for um valor válido (negativo, 3+ casas decimais, letras...).
 */
export function parseMoneyToCents(input: string): number | null {
  const text = input.replace(/\s|R\$/g, "");
  if (!text) return null;
  // aceita milhar com ponto e decimal com vírgula; ou só dígitos com 1 separador decimal
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const whole = Number(m[1].replace(/\./g, ""));
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + frac;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 1990 -> "19,90" (valor para campo de formulário, sem milhar). */
export function centsToInput(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole},${frac}`;
}
