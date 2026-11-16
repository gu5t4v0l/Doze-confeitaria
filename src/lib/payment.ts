/**
 * Pagamento por encomenda: sinal antecipado (Pix) + restante na entrega/retirada.
 * Funções puras; tudo em centavos inteiros. Não há pagamento online no site.
 */
import { formatBRLPlain } from "@/lib/money";

export const DEFAULT_DEPOSIT_PERCENT = 50;

export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];
/** "" = sem tipo (chave não cadastrada). */
export type PixKeyTypeOrEmpty = PixKeyType | "";

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

export const MAX_PIX_KEY_LENGTH = 140;
export const MAX_PIX_HOLDER_LENGTH = 80;
export const MAX_PAYMENT_NOTE_LENGTH = 300;

/** Garante inteiro 0–100; qualquer lixo vira o padrão (50). */
export function sanitizeDepositPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_DEPOSIT_PERCENT;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export interface PaymentSplit {
  percent: number;
  totalCents: number;
  depositCents: number;
  remainingCents: number;
}

/** deposit + remaining === total SEMPRE (o restante é a diferença, nunca outro arredondamento). */
export function computePayment(totalCents: number, percent: number): PaymentSplit {
  const total = Number.isFinite(totalCents) ? Math.max(0, Math.trunc(totalCents)) : 0;
  const p = sanitizeDepositPercent(percent);
  const depositCents = Math.round((total * p) / 100);
  return { percent: p, totalCents: total, depositCents, remainingCents: total - depositCents };
}

/** Linha fixa da vitrine, gerada do percentual. null quando o sinal está desativado (0%). */
export function paymentNoticeLine(percent: number): string | null {
  const p = sanitizeDepositPercent(percent);
  if (p === 0) return null;
  if (p === 100) return "Pagamento: 100% antecipado por Pix para confirmar a encomenda.";
  return `Pagamento: ${p}% antecipado por Pix para confirmar a encomenda; o restante na entrega ou retirada.`;
}

/** Texto do bloco "Pagamento" do carrinho. */
export function paymentSummaryText(split: PaymentSplit): string {
  const deposit = formatBRLPlain(split.depositCents);
  if (split.percent >= 100) {
    return `Para confirmar a encomenda pedimos o pagamento antecipado por Pix: ${deposit} agora.`;
  }
  return `Para confirmar a encomenda pedimos ${split.percent}% antecipado por Pix: ${deposit} agora. Os outros ${formatBRLPlain(split.remainingCents)} você paga na entrega/retirada.`;
}

/** Chave para exibição (CPF/CNPJ com máscara); a cópia usa sempre o valor guardado. */
export function formatPixKeyForDisplay(type: PixKeyTypeOrEmpty, key: string): string {
  const d = key.replace(/\D/g, "");
  if (type === "cpf" && d.length === 11 && d === key) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (type === "cnpj" && d.length === 14 && d === key) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return key;
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/** Remove caracteres de controle (quebras viram espaço) e aperta espaços. */
export function stripControl(text: string): string {
  return text.replace(/[\r\n\t]+/g, " ").replace(CONTROL, "").replace(/ {2,}/g, " ").trim();
}

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validação leve da chave Pix pelo tipo. Devolve a chave normalizada
 * (cpf/cnpj só dígitos; telefone "+55DDDNÚMERO"; e-mail e aleatória em minúsculas) ou null.
 */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const key = raw.trim();
  switch (type) {
    case "cpf": {
      const d = key.replace(/[.\-\s]/g, "");
      return /^\d{11}$/.test(d) ? d : null;
    }
    case "cnpj": {
      const d = key.replace(/[.\-/\s]/g, "");
      return /^\d{14}$/.test(d) ? d : null;
    }
    case "email":
      return key.length <= 77 && EMAIL.test(key) ? key.toLowerCase() : null;
    case "telefone": {
      if (!/^\+?[\d\s()\-]+$/.test(key)) return null;
      if (key.startsWith("+") && !/^\+\s*55/.test(key)) return null; // só Brasil (DDI 55)
      let d = key.replace(/\D/g, "");
      if (d.length === 10 || d.length === 11) d = `55${d}`;
      return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
    }
    case "aleatoria":
      return UUID.test(key) && key.length >= 32 && key.length <= 36 ? key.toLowerCase() : null;
  }
}
