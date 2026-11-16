import type { CatalogCategory, CatalogItem, CatalogOption } from "@/lib/catalog-types";

/** Limites de unidades por linha do carrinho. */
export const MIN_QTY = 1;
export const MAX_QTY = 99;

/** Carrinho = { chaveDaLinha: quantidade }. NUNCA guarda preço. */
export type Cart = Record<string, number>;

const KEY_SEP = "~";

export interface CartOption {
  /** "slug-do-item" (sem opções) ou "slug-do-item~idDaOpcao". */
  key: string;
  item: CatalogItem;
  option?: CatalogOption;
  /** Rótulo da opção quando o item tem opções (ex.: "Tradicional"). */
  optionLabel?: string;
  unitPriceCents: number;
}

export interface CartLine extends CartOption {
  qty: number;
  totalCents: number;
}

/** Índice de tudo que pode ser comprado, na ordem do cardápio. */
export type CatalogIndex = ReadonlyMap<string, CartOption>;

export function lineKey(itemId: string, optionId?: number): string {
  return optionId === undefined ? itemId : `${itemId}${KEY_SEP}${optionId}`;
}

/** Itens com opções são comprados POR opção; sem opções, pelo próprio item. */
export function buildCatalogIndex(categories: CatalogCategory[]): CatalogIndex {
  const map = new Map<string, CartOption>();
  for (const category of categories) {
    for (const item of category.items) {
      if (item.options.length === 0) {
        map.set(item.id, { key: item.id, item, unitPriceCents: item.priceCents });
        continue;
      }
      for (const option of item.options) {
        const key = lineKey(item.id, option.id);
        map.set(key, {
          key,
          item,
          option,
          optionLabel: option.label,
          unitPriceCents: option.priceCents,
        });
      }
    }
  }
  return map;
}

/** Opções compráveis de um item. */
export function optionsFor(item: CatalogItem, index: CatalogIndex): CartOption[] {
  const keys =
    item.options.length === 0 ? [item.id] : item.options.map((o) => lineKey(item.id, o.id));
  return keys.flatMap((k) => {
    const opt = index.get(k);
    return opt ? [opt] : [];
  });
}

/** Normaliza a quantidade para 0 (remover) ou 1–99. */
export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  const n = Math.trunc(qty);
  if (n < MIN_QTY) return 0;
  return Math.min(n, MAX_QTY);
}

/** Só a FORMA: objeto de chave string -> inteiro 1–99 (sem consultar o catálogo). */
export function sanitizeCartShape(raw: unknown): Cart {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clean: Cart = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isInteger(value)) continue;
    const qty = clampQty(value);
    if (qty > 0) Object.defineProperty(clean, key, { value: qty, enumerable: true, writable: true, configurable: true });
  }
  return clean;
}

/**
 * Valida qualquer valor vindo do localStorage contra o catálogo do servidor:
 * descarta chaves desconhecidas/ocultas e quantidades inválidas; limita a 1–99.
 */
export function sanitizeCart(raw: unknown, index: CatalogIndex): Cart {
  const shaped = sanitizeCartShape(raw);
  const clean: Cart = {};
  for (const [key, qty] of Object.entries(shaped)) {
    if (index.has(key)) clean[key] = qty;
  }
  return clean;
}

/** Retorna um novo carrinho com a quantidade da linha alterada (0 remove). */
export function setQty(cart: Cart, key: string, qty: number, index: CatalogIndex): Cart {
  if (!index.has(key)) return cart;
  const next = { ...cart };
  const q = clampQty(qty);
  if (q === 0) delete next[key];
  else next[key] = q;
  return next;
}

/** Linhas do carrinho, na ordem do catálogo, com preços SEMPRE do catálogo. */
export function getLines(cart: Cart, index: CatalogIndex): CartLine[] {
  const lines: CartLine[] = [];
  for (const [key, option] of index) {
    const qty = clampQty(cart[key] ?? 0);
    if (qty > 0) lines.push({ ...option, qty, totalCents: option.unitPriceCents * qty });
  }
  return lines;
}

export function cartSummary(
  cart: Cart,
  index: CatalogIndex,
): { count: number; totalCents: number } {
  const lines = getLines(cart, index);
  return {
    count: lines.reduce((s, l) => s + l.qty, 0),
    totalCents: lines.reduce((s, l) => s + l.totalCents, 0),
  };
}
