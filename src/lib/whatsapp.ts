import { getLines, cartSummary, type Cart, type CartLine, type CatalogIndex } from "@/lib/cart";
import { formatBRLPlain, formatDateBR } from "@/lib/format";
import { computePayment, DEFAULT_DEPOSIT_PERCENT } from "@/lib/payment";

export type Fulfillment = "entrega" | "retirada";

export interface OrderInput {
  cart: Cart;
  /** Catálogo vindo do servidor: dele vêm nomes e preços. */
  index: CatalogIndex;
  name?: string;
  fulfillment?: Fulfillment | null;
  /** Data desejada, "AAAA-MM-DD". */
  date?: string;
  notes?: string;
  /** Sinal em % (0–100). Vem das configurações; padrão 50. 0 = sem linhas de sinal. */
  depositPercent?: number;
}

export const MAX_NAME_LENGTH = 80;
export const MAX_NOTES_LENGTH = 500;
/** Limite prático para a URL do wa.me (aceita bem até ~2000 caracteres). */
export const MAX_URL_LENGTH = 2000;

const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
};

function lineTitle(line: CartLine): string {
  return line.optionLabel ? `${line.item.name} (${line.optionLabel})` : line.item.name;
}

/** Corta por pontos de código (nunca parte um emoji ao meio). */
function truncate(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("");
}

function cleanSingleLine(text: string | undefined, max: number): string {
  return truncate((text ?? "").replace(/\s+/g, " ").trim(), max);
}

function cleanMultiline(text: string | undefined, max: number): string {
  return truncate(
    (text ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    max,
  );
}

/**
 * Níveis de enxugamento da mensagem (o sinal nunca sai):
 * 0 completa · 1 sem preço por linha e obs. curta · 2 sem obs., nome curto, pagamento resumido
 * · 3 igual ao 2 e com só os primeiros N itens ("e mais X itens").
 */
type Level = 0 | 1 | 2 | 3;

interface BuildOptions {
  compact?: boolean;
  level?: Level;
  /** Nível 3: quantos itens manter. */
  keepItems?: number;
}

function paymentLines(totalCents: number, percent: number, short: boolean): string[] {
  const split = computePayment(totalCents, percent);
  if (split.percent === 0) return [];
  const deposit = formatBRLPlain(split.depositCents);
  const rest = formatBRLPlain(split.remainingCents);
  if (short) return [`💰 Sinal ${split.percent}% (Pix): ${deposit}`, `Restante: ${rest}`];
  return [
    `💰 Sinal de ${split.percent}% (Pix): ${deposit}`,
    `Restante na entrega/retirada: ${rest}`,
  ];
}

/** Função pura: monta o texto do pedido. Preços vêm sempre do catálogo. */
export function buildWhatsAppMessage(order: OrderInput, options: BuildOptions = {}): string {
  const level: Level = options.level ?? (options.compact ? 1 : 0);
  const lines = getLines(order.cart, order.index);
  if (lines.length === 0) return "";

  const percent = order.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
  const { totalCents } = cartSummary(order.cart, order.index);
  const withPrice = level === 0;
  const kept = level === 3 ? Math.max(0, Math.min(options.keepItems ?? 0, lines.length)) : lines.length;
  const items = lines
    .slice(0, kept)
    .map((l) =>
      withPrice
        ? `• ${l.qty}x ${lineTitle(l)} — ${formatBRLPlain(l.totalCents)}`
        : `• ${l.qty}x ${lineTitle(l)}`,
    );
  if (kept < lines.length) {
    const more = lines.length - kept;
    items.push(`• … e mais ${more} ${more === 1 ? "item" : "itens"} (confirmo pelo total)`);
  }

  const name = cleanSingleLine(order.name, level >= 2 ? 30 : MAX_NAME_LENGTH);
  const notes = level >= 2 ? "" : cleanMultiline(order.notes, level === 1 ? 200 : MAX_NOTES_LENGTH);

  const details: string[] = [];
  if (name) details.push(`Nome: ${name}`);
  if (order.fulfillment && FULFILLMENT_LABEL[order.fulfillment]) {
    details.push(`Entrega/Retirada: ${FULFILLMENT_LABEL[order.fulfillment]}`);
  }
  if (order.date && /^\d{4}-\d{2}-\d{2}$/.test(order.date)) {
    details.push(`Data desejada: ${formatDateBR(order.date)}`);
  }
  if (notes) details.push(`Obs: ${notes}`);

  const farewell =
    computePayment(totalCents, percent).percent > 0
      ? "Aguardo a confirmação e a chave Pix para o sinal. Obrigado!"
      : "Aguardo a confirmação e os detalhes de pagamento. Obrigado!";

  return [
    "Olá, DoZé Confeitaria! 🍰 Gostaria de fazer um pedido:",
    "",
    ...items,
    "",
    `Total: ${formatBRLPlain(totalCents)}`,
    ...paymentLines(totalCents, percent, level >= 2),
    ...details,
    "",
    farewell,
  ].join("\n");
}

function toUrl(number: string, message: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message.toWellFormed())}`;
}

/**
 * Monta a URL do wa.me. Se ficar grande demais, enxuga em etapas (sem preço por linha,
 * sem observações, menos itens). Total e sinal NUNCA são cortados.
 */
export function buildWhatsAppUrl(number: string, order: OrderInput): string {
  for (const level of [0, 1, 2] as const) {
    const url = toUrl(number, buildWhatsAppMessage(order, { level }));
    if (url.length <= MAX_URL_LENGTH) return url;
  }
  const count = getLines(order.cart, order.index).length;
  let url = "";
  for (let keep = count - 1; keep >= 0; keep--) {
    url = toUrl(number, buildWhatsAppMessage(order, { level: 3, keepItems: keep }));
    if (url.length <= MAX_URL_LENGTH) return url;
  }
  return url;
}
