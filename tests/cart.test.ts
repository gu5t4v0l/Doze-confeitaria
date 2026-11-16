import { describe, it, expect } from "vitest";
import { fallbackCatalog } from "@/data/menu";
import {
  buildCatalogIndex,
  cartSummary,
  clampQty,
  getLines,
  lineKey,
  optionsFor,
  sanitizeCart,
  sanitizeCartShape,
  setQty,
  MAX_QTY,
} from "@/lib/cart";
import type { CatalogCategory } from "@/lib/catalog-types";

const categories = fallbackCatalog().categories;
const index = buildCatalogIndex(categories);

const PUDIM = "pudim-leite-condensado";
const BITS = "bits-de-panetone";
const BITS_T = lineKey(BITS, 1);
const BITS_DL = lineKey(BITS, 2);

describe("clampQty", () => {
  it.each([
    [0, 0], [-5, 0], [0.9, 0], [1, 1], [1.9, 1], [99, 99], [100, 99], [1e9, 99],
    [NaN, 0], [Infinity, 0], [-Infinity, 0],
  ])("clampQty(%s) = %s", (i, o) => expect(clampQty(i)).toBe(o));
});

describe("setQty", () => {
  it("adiciona, altera e remove (0)", () => {
    let c = setQty({}, PUDIM, 1, index);
    expect(c).toEqual({ [PUDIM]: 1 });
    c = setQty(c, PUDIM, 5, index);
    expect(c[PUDIM]).toBe(5);
    c = setQty(c, PUDIM, 0, index);
    expect(c).toEqual({});
  });
  it("limita a 99 e remove com negativos", () => {
    expect(setQty({}, PUDIM, 500, index)[PUDIM]).toBe(MAX_QTY);
    expect(setQty({ [PUDIM]: 3 }, PUDIM, -1, index)).toEqual({});
  });
  it("ignora chave inexistente e não muta o original", () => {
    const c = { [PUDIM]: 2 };
    expect(setQty(c, "fake", 3, index)).toBe(c);
    const n = setQty(c, PUDIM, 4, index);
    expect(c[PUDIM]).toBe(2);
    expect(n).not.toBe(c);
  });
});

describe("opções (variantes)", () => {
  it("Bits tem duas opções (19 e 25) como linhas distintas; item com opções não é comprável sem escolher", () => {
    const item = categories.flatMap((c) => c.items).find((i) => i.id === BITS)!;
    expect(optionsFor(item, index).map((o) => o.unitPriceCents)).toEqual([1900, 2500]);
    expect(index.has(BITS)).toBe(false);
    const cart = { [BITS_T]: 2, [BITS_DL]: 1 };
    const lines = getLines(cart, index);
    expect(lines.map((l) => l.totalCents)).toEqual([3800, 2500]);
    expect(cartSummary(cart, index)).toEqual({ count: 3, totalCents: 6300 });
  });
  it("seed tem 10 linhas compráveis (9 itens, 1 com 2 opções)", () => {
    expect(index.size).toBe(10);
  });
});

describe("cartSummary / getLines", () => {
  it("vazio", () => expect(cartSummary({}, index)).toEqual({ count: 0, totalCents: 0 }));
  it("ignora chaves falsas e quantidade inválida", () => {
    expect(getLines({ fake: 3, [PUDIM]: -2 }, index)).toEqual([]);
  });
  it("total máximo de uma linha", () => {
    expect(cartSummary({ [PUDIM]: 99 }, index).totalCents).toBe(4900 * 99);
  });
});

describe("sanitizeCart (localStorage sujo)", () => {
  it.each([null, undefined, "str", 42, true, [], [1, 2]])("não-objeto %j -> {}", (raw) => {
    expect(sanitizeCart(raw, index)).toEqual({});
  });
  it("descarta ids falsos, negativos, zero, decimais, NaN, strings, null, objetos", () => {
    const raw = {
      fake: 2, [PUDIM]: 3, "delicia-de-uva": -1, "bolo-de-brigadeiro": 0,
      "bolo-de-prestigio": 1.5, "torta-de-frango": NaN, "pao-de-mel": "3",
      "bolo-de-cenoura-brigadeiro": null, "bolo-de-morango-leite-condensado": { a: 1 },
    };
    expect(sanitizeCart(raw, index)).toEqual({ [PUDIM]: 3 });
  });
  it("limita acima de 99 e aceita opções válidas", () => {
    expect(sanitizeCart({ [PUDIM]: 1000, [BITS_DL]: 2 }, index)).toEqual({ [PUDIM]: 99, [BITS_DL]: 2 });
  });
  it("Infinity e chaves de protótipo são descartados", () => {
    const raw = JSON.parse('{"__proto__": 3, "constructor": 2, "toString": 1}');
    expect(sanitizeCart({ ...raw, [PUDIM]: Infinity }, index)).toEqual({});
  });
  it("preço nunca vem do storage: campos extras são ignorados", () => {
    const c = sanitizeCart({ [PUDIM]: 1, price: 0.01, total: 1 }, index);
    expect(c).toEqual({ [PUDIM]: 1 });
    expect(getLines(c, index)[0].unitPriceCents).toBe(4900);
  });
});

describe("catálogo do servidor muda (itens removidos ou escondidos)", () => {
  it("chaves que saíram do catálogo são descartadas; as demais seguem", () => {
    const trimmed: CatalogCategory[] = categories.map((c) => ({
      ...c,
      items: c.items.filter((i) => i.id !== "pao-de-mel" && i.id !== BITS),
    }));
    const smaller = buildCatalogIndex(trimmed);
    const cart = { [PUDIM]: 2, "pao-de-mel": 1, [BITS_DL]: 1 };
    expect(sanitizeCart(cart, smaller)).toEqual({ [PUDIM]: 2 });
    expect(getLines(cart, smaller)).toHaveLength(1);
  });
  it("preço atualizado no catálogo vale para o que já está no carrinho", () => {
    const repriced = categories.map((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === PUDIM ? { ...i, priceCents: 5500 } : i)),
    }));
    expect(cartSummary({ [PUDIM]: 2 }, buildCatalogIndex(repriced)).totalCents).toBe(11000);
  });
  it("sanitizeCartShape só valida a forma", () => {
    expect(sanitizeCartShape({ qualquer: 3, ruim: -1 })).toEqual({ qualquer: 3 });
  });
});
