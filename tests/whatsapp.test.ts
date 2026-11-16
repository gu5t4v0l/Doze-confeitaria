import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl, MAX_NOTES_LENGTH, MAX_NAME_LENGTH, MAX_URL_LENGTH } from "@/lib/whatsapp";
import { buildCatalogIndex, lineKey } from "@/lib/cart";
import { fallbackCatalog } from "@/data/menu";

const index = buildCatalogIndex(fallbackCatalog().categories);

const NUM = "5511911454427";
const BITS = "bits-de-panetone";
const BITS_T = lineKey(BITS, 1); // Tradicional
const BITS_DL = lineKey(BITS, 2); // Com recheio de doce de leite 200g
const BIG_CART = {
  "pudim-leite-condensado": 99, "delicia-de-uva": 99, "bolo-de-brigadeiro": 99,
  "bolo-de-cenoura-brigadeiro": 99, "bolo-de-morango-leite-condensado": 99,
  "bolo-de-prestigio": 99, "torta-de-frango": 99, [BITS_T]: 99, [BITS_DL]: 99, "pao-de-mel": 99,
};
const textOf = (u: string) => decodeURIComponent(u.split("?text=")[1]);

describe("buildWhatsAppMessage", () => {
  it("abre com DoZé Confeitaria", () => {
    expect(buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 } })).toMatch(/^Olá, DoZé Confeitaria!/);
  });
  it("carrinho vazio -> string vazia", () => {
    expect(buildWhatsAppMessage({ index, cart: {} })).toBe("");
  });
  it("lista quantidades, itens, subtotais e total em BRL", () => {
    const m = buildWhatsAppMessage({ index, cart: { "pudim-leite-condensado": 2, "pao-de-mel": 3 } });
    expect(m).toContain("• 2x Pudim de leite condensado 900g — R$ 98,00");
    expect(m).toContain("• 3x Pão de mel — R$ 36,00");
    expect(m).toContain("Total: R$ 134,00");
  });
  it("opções do Bits em linhas distintas com preços 19 e 25", () => {
    const m = buildWhatsAppMessage({ index, cart: { [BITS_T]: 1, [BITS_DL]: 2 } });
    expect(m).toContain("• 1x Bits de Panetone 200g (Tradicional) — R$ 19,00");
    expect(m).toContain("• 2x Bits de Panetone 200g (Com recheio de doce de leite 200g) — R$ 50,00");
    expect(m).toContain("Total: R$ 69,00");
  });
  it("sem NBSP no texto", () => {
    expect(buildWhatsAppMessage({ index, cart: { [BITS_T]: 1 } })).not.toMatch(/[  ]/);
  });
  it("campos opcionais ausentes não geram detalhes", () => {
    const m = buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 } });
    expect(m).not.toMatch(/Nome:|Entrega\/Retirada:|Data desejada:|Obs:/);
  });
  it("inclui todos os campos quando presentes", () => {
    const m = buildWhatsAppMessage({
      index, cart: { "pao-de-mel": 1 }, name: "  Maria   da  Silva ", fulfillment: "entrega",
      date: "2026-12-20", notes: "sem granulado",
    });
    expect(m).toContain("Nome: Maria da Silva");
    expect(m).toContain("Entrega/Retirada: Entrega");
    expect(m).toContain("Data desejada: 20/12/2026");
    expect(m).toContain("Obs: sem granulado");
  });
  it("retirada e fulfillment null", () => {
    expect(buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, fulfillment: "retirada" })).toContain("Retirada");
    expect(buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, fulfillment: null })).not.toContain("Entrega/Retirada");
  });
  it("data mal formatada é omitida", () => {
    expect(buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, date: "20/12/2026" })).not.toContain("Data desejada");
  });
  it("nome e observações são limitados", () => {
    const m = buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, name: "a".repeat(500), notes: "b".repeat(2000) });
    expect(m).toContain("Nome: " + "a".repeat(MAX_NAME_LENGTH) + "\n");
    expect(m).toContain("Obs: " + "b".repeat(MAX_NOTES_LENGTH) + "\n");
  });
  it("nome com quebra vira uma linha; obs mantém quebras e normaliza CRLF", () => {
    const m = buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, name: "A\nB", notes: "l1\r\nl2\n\n\n\nl3" });
    expect(m).toContain("Nome: A B");
    expect(m).toContain("Obs: l1\nl2\n\nl3");
  });
  it("só espaços em nome/obs é tratado como ausente", () => {
    expect(buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 }, name: "   ", notes: " \n " })).not.toMatch(/Nome:|Obs:/);
  });
  it("compacto não traz preço por linha", () => {
    const m = buildWhatsAppMessage({ index, cart: { "pao-de-mel": 1 } }, { compact: true });
    expect(m).toContain("• 1x Pão de mel\n");
    expect(m).toContain("Total: R$ 12,00");
  });
});

describe("buildWhatsAppUrl", () => {
  it("usa wa.me com o número (só dígitos)", () => {
    expect(buildWhatsAppUrl(NUM, { index, cart: { "pao-de-mel": 1 } }).startsWith(`https://wa.me/${NUM}?text=`)).toBe(true);
    expect(buildWhatsAppUrl("+55 (11) 91145-4427", { index, cart: { "pao-de-mel": 1 } }).startsWith(`https://wa.me/${NUM}?text=`)).toBe(true);
  });
  it("encoding: acentos, emoji, &, #, quebras de linha e ida-e-volta", () => {
    const order = { index, cart: { "pao-de-mel": 1 }, name: "José & Cia #1 ção 🎂", notes: "linha1\nlinha2 100% ? = +" };
    const u = buildWhatsAppUrl(NUM, order);
    const query = u.split("?text=")[1];
    for (const ch of ["&", "#", "\n", " "]) expect(query).not.toContain(ch);
    expect(query).toContain("%0A");
    expect(query).toContain("%26");
    expect(query).toContain("%23");
    expect(decodeURIComponent(query)).toBe(buildWhatsAppMessage(order));
    expect(new URL(u).searchParams.get("text")).toBe(buildWhatsAppMessage(order));
  });
  it("URL curta usa a mensagem completa (preço por linha)", () => {
    expect(textOf(buildWhatsAppUrl(NUM, { index, cart: { "pao-de-mel": 2 } }))).toContain("— R$ 24,00");
  });
  it("com observações longas cai no compacto e fica <= 2000", () => {
    const order = {
      index, cart: { "pudim-leite-condensado": 1, "delicia-de-uva": 1, "bolo-de-brigadeiro": 1, [BITS_T]: 1, [BITS_DL]: 1, "pao-de-mel": 1 },
      name: "Maria",
      notes: "ç".repeat(MAX_NOTES_LENGTH),
    };
    expect(encodeURIComponent(buildWhatsAppMessage(order)).length).toBeGreaterThan(MAX_URL_LENGTH);
    const u = buildWhatsAppUrl(NUM, order);
    expect(u.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    const text = textOf(u);
    expect(text).not.toContain("— R$");
    expect(text).toContain("Total: R$");
    expect(text).toContain("• 1x Pudim");
  });
  it("pior caso (emojis + 10 linhas qty 99) é cortado e fica <= 2000", () => {
    const u = buildWhatsAppUrl(NUM, { index, cart: BIG_CART, name: "😀".repeat(80), notes: "😀\n".repeat(250) });
    expect(u.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
  });
});

describe("emoji na fronteira dos limites nunca quebra a URL (regressão URIError)", () => {
  const base = { index, cart: { "pao-de-mel": 1 } };
  const safe = (order: Parameters<typeof buildWhatsAppUrl>[1]) => {
    let u = "";
    expect(() => { u = buildWhatsAppUrl(NUM, order); }).not.toThrow();
    expect(() => decodeURIComponent(u.split("?text=")[1])).not.toThrow();
    expect(u).not.toMatch(/%ED%[A-B]/i); // sem surrogate solto codificado
    expect(u.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    return u;
  };

  it.each([0, 1])("nome: emoji cruzando o limite de %i unidade(s) UTF-16", (shift) => {
    const name = "a".repeat(MAX_NAME_LENGTH - 1 - shift) + "😀😀";
    const u = safe({ ...base, name });
    expect(textOf(u)).toContain("Nome: " + Array.from(name).slice(0, MAX_NAME_LENGTH).join("") + "\n");
  });
  it("nome só de emojis é cortado em 80 pontos de código", () => {
    const u = safe({ ...base, name: "😀".repeat(200) });
    expect(textOf(u)).toContain("Nome: " + "😀".repeat(MAX_NAME_LENGTH) + "\n");
  });
  it.each([0, 1])("observações: emoji na posição 500 (shift %i)", (shift) => {
    const notes = "a".repeat(MAX_NOTES_LENGTH - 1 - shift) + "😀😀";
    const u = safe({ ...base, notes });
    expect(textOf(u)).toContain("Obs: " + Array.from(notes).slice(0, MAX_NOTES_LENGTH).join("") + "\n");
  });
  it("modo compacto: emoji exatamente no limite de 200", () => {
    for (const shift of [0, 1, 2]) {
      const order = {
        index, cart: { "pudim-leite-condensado": 1, "delicia-de-uva": 1, "bolo-de-brigadeiro": 1, [BITS_T]: 1, [BITS_DL]: 1 },
        name: "😀".repeat(80),
        notes: "a".repeat(199 - shift) + "😀😀" + "ç".repeat(300),
      };
      const u = safe(order);
      expect(textOf(u)).not.toContain("— R$");
    }
  });
  it("corte final em blocos: varia o comprimento para cruzar surrogates em todas as posições", () => {
    for (let n = 0; n < 12; n++) {
      safe({ index, cart: BIG_CART, name: "😀".repeat(80), notes: "x".repeat(n) + "😀".repeat(500) });
    }
  });
  it("corte final termina com mensagem de poucos pontos de código mas muitas unidades UTF-16 (sem loop infinito)", () => {
    safe({ index, cart: BIG_CART, name: "😀".repeat(80), notes: "😀".repeat(500) });
  });
  it("nunca lança com cadeias aleatórias contendo emojis, CRLF e surrogates soltos", () => {
    const alphabet = ["a", "ç", "😀", "👨‍👩‍👧", "\n", "\r\n", "&", "#", "\ud83d", "\ude00", " "];
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 200; i++) {
      const gen = (len: number) => Array.from({ length: len }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join("");
      safe({ index, cart: i % 2 ? BIG_CART : base.cart, name: gen(Math.floor(rnd() * 120)), notes: gen(Math.floor(rnd() * 700)) });
    }
  });
});

describe("pagamento (sinal) na mensagem", () => {
  const cartA = { "pudim-leite-condensado": 1, "pao-de-mel": 1 }; // 49 + 12 = 61
  it("padrão 50%: total, sinal e restante + despedida com Pix", () => {
    const m = buildWhatsAppMessage({ index, cart: cartA });
    expect(m).toMatch(/Total: R\$ [\d.,]+\n💰 Sinal de 50% \(Pix\): R\$ [\d.,]+\nRestante na entrega\/retirada: R\$ [\d.,]+\n/);
    expect(m).toContain("Aguardo a confirmação e a chave Pix para o sinal.");
  });
  it("valores corretos e soma fecha (total ímpar)", () => {
    const m = buildWhatsAppMessage({ index, cart: { [BITS_T]: 1 }, depositPercent: 50 }); // R$ 19,00
    expect(m).toContain("Total: R$ 19,00\n💰 Sinal de 50% (Pix): R$ 9,50\nRestante na entrega/retirada: R$ 9,50");
    const m33 = buildWhatsAppMessage({ index, cart: { [BITS_T]: 1 }, depositPercent: 33 });
    expect(m33).toContain("Sinal de 33% (Pix): R$ 6,27");
    expect(m33).toContain("Restante na entrega/retirada: R$ 12,73");
  });
  it("percentual vem do parâmetro; 0 remove as linhas e troca a despedida", () => {
    const m30 = buildWhatsAppMessage({ index, cart: cartA, depositPercent: 30 });
    expect(m30).toContain("Sinal de 30% (Pix): R$ 18,30");
    expect(m30).toContain("Restante na entrega/retirada: R$ 42,70");
    const m0 = buildWhatsAppMessage({ index, cart: cartA, depositPercent: 0 });
    expect(m0).not.toMatch(/Sinal|Restante|Pix/);
    expect(m0).toContain("Aguardo a confirmação e os detalhes de pagamento.");
  });
  it("100%: restante zerado", () => {
    expect(buildWhatsAppMessage({ index, cart: cartA, depositPercent: 100 })).toContain("Restante na entrega/retirada: R$ 0,00");
  });
  it("linhas de pagamento ficam logo após o total, antes dos detalhes", () => {
    const m = buildWhatsAppMessage({ index, cart: cartA, name: "Ana", depositPercent: 50 });
    expect(m.indexOf("Total:")).toBeLessThan(m.indexOf("Sinal"));
    expect(m.indexOf("Restante")).toBeLessThan(m.indexOf("Nome: Ana"));
  });
  it("modo compacto mantém o sinal", () => {
    const m = buildWhatsAppMessage({ index, cart: cartA }, { compact: true });
    expect(m).toContain("💰 Sinal de 50% (Pix): R$ 30,50");
    expect(m).toContain("Restante na entrega/retirada: R$ 30,50");
  });
  it("URL: com texto enorme o sinal e o total sobrevivem, <= 2000, sem surrogate solto", () => {
    const orders = [
      { index, cart: BIG_CART, name: "😀".repeat(80), notes: "😀\n".repeat(250), depositPercent: 50 },
      { index, cart: BIG_CART, name: "Maria", notes: "ç".repeat(MAX_NOTES_LENGTH), depositPercent: 30 },
      { index, cart: { [BITS_T]: 1, [BITS_DL]: 2, "pao-de-mel": 3 }, name: "x", notes: "ç".repeat(MAX_NOTES_LENGTH), depositPercent: 50 },
    ];
    for (const order of orders) {
      const u = buildWhatsAppUrl(NUM, order);
      expect(u.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
      const text = textOf(u);
      expect(text).toContain("Total: R$");
      expect(text.includes(`Sinal ${order.depositPercent}% (Pix): R$`) || text.includes(`Sinal de ${order.depositPercent}% (Pix): R$`)).toBe(true);
      expect(text).toContain("Restante");
      expect(text).toContain("chave Pix para o sinal");
      expect(u).not.toMatch(/%ED%[A-B]/i);
    }
  });
  it("com sinal 0 e texto enorme continua <= 2000", () => {
    const u = buildWhatsAppUrl(NUM, { index, cart: BIG_CART, name: "😀".repeat(80), notes: "😀\n".repeat(250), depositPercent: 0 });
    expect(u.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(textOf(u)).toContain("Total: R$");
  });
});
