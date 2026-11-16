export { formatBRL, formatBRLCompact, formatBRLPlain } from "@/lib/money";

/** "2026-12-24" -> "24/12/2026" (sem passar por fuso horário). */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatItemCount(n: number): string {
  return `${n} ${n === 1 ? "item" : "itens"}`;
}

/** "5511911454427" -> "(11) 91145-4427"; devolve os dígitos se não reconhecer. */
export function formatPhoneBR(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}
