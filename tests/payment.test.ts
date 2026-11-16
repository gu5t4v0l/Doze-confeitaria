import { describe, it, expect } from "vitest";
import {
  computePayment,
  formatPixKeyForDisplay,
  normalizePixKey,
  paymentNoticeLine,
  paymentSummaryText,
  sanitizeDepositPercent,
  stripControl,
} from "@/lib/payment";
import { settingsSchema } from "@/lib/admin/schemas";
import { toPublicCatalog } from "@/lib/catalog-transform";
import { defaultSettings } from "@/data/menu";

describe("computePayment", () => {
  it("50% de total par e ímpar (arredonda e a soma fecha)", () => {
    expect(computePayment(26300, 50)).toMatchObject({ depositCents: 13150, remainingCents: 13150 });
    expect(computePayment(1001, 50)).toMatchObject({ depositCents: 501, remainingCents: 500 });
    expect(computePayment(1, 50)).toMatchObject({ depositCents: 1, remainingCents: 0 });
  });
  it("0% e 100%", () => {
    expect(computePayment(12345, 0)).toMatchObject({ depositCents: 0, remainingCents: 12345 });
    expect(computePayment(12345, 100)).toMatchObject({ depositCents: 12345, remainingCents: 0 });
  });
  it("33% e 30% com arredondamento", () => {
    expect(computePayment(1000, 33)).toMatchObject({ depositCents: 330, remainingCents: 670 });
    expect(computePayment(1999, 33)).toMatchObject({ depositCents: 660, remainingCents: 1339 });
    expect(computePayment(5000, 30)).toMatchObject({ depositCents: 1500, remainingCents: 3500 });
  });
  it("a soma sempre fecha no total (varredura) e o sinal nunca passa do total", () => {
    for (let total = 0; total <= 2000; total += 7) {
      for (let p = 0; p <= 100; p++) {
        const r = computePayment(total, p);
        expect(r.depositCents + r.remainingCents).toBe(total);
        expect(Number.isInteger(r.depositCents)).toBe(true);
        expect(r.depositCents).toBeGreaterThanOrEqual(0);
        expect(r.remainingCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("entradas absurdas são saneadas", () => {
    expect(sanitizeDepositPercent(NaN)).toBe(50);
    expect(sanitizeDepositPercent("50")).toBe(50);
    expect(sanitizeDepositPercent(150)).toBe(100);
    expect(sanitizeDepositPercent(-5)).toBe(0);
    expect(computePayment(-100, 50)).toMatchObject({ totalCents: 0, depositCents: 0 });
  });
});

describe("textos de pagamento", () => {
  it("linha da vitrine vem do percentual", () => {
    expect(paymentNoticeLine(50)).toBe(
      "Pagamento: 50% antecipado por Pix para confirmar a encomenda; o restante na entrega ou retirada.",
    );
    expect(paymentNoticeLine(30)).toContain("30%");
    expect(paymentNoticeLine(100)).not.toContain("restante");
    expect(paymentNoticeLine(0)).toBeNull();
  });
  it("resumo do carrinho com valores em R$", () => {
    expect(paymentSummaryText(computePayment(26300, 50))).toBe(
      "Para confirmar a encomenda pedimos 50% antecipado por Pix: R$ 131,50 agora. Os outros R$ 131,50 você paga na entrega/retirada.",
    );
    expect(paymentSummaryText(computePayment(10000, 100))).not.toContain("Os outros");
  });
  it("máscara de CPF/CNPJ só na exibição", () => {
    expect(formatPixKeyForDisplay("cpf", "12345678909")).toBe("123.456.789-09");
    expect(formatPixKeyForDisplay("cnpj", "12345678000195")).toBe("12.345.678/0001-95");
    expect(formatPixKeyForDisplay("email", "a@b.com")).toBe("a@b.com");
  });
});

describe("normalizePixKey", () => {
  it("cpf/cnpj: só 11/14 dígitos", () => {
    expect(normalizePixKey("cpf", "123.456.789-09")).toBe("12345678909");
    expect(normalizePixKey("cpf", "1234567890")).toBeNull();
    expect(normalizePixKey("cpf", "abcdefghijk")).toBeNull();
    expect(normalizePixKey("cnpj", "12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizePixKey("cnpj", "12345678909")).toBeNull();
  });
  it("e-mail", () => {
    expect(normalizePixKey("email", " Maria@Exemplo.com ")).toBe("maria@exemplo.com");
    for (const bad of ["maria", "maria@", "@x.com", "a b@x.com", "a@b"]) expect(normalizePixKey("email", bad)).toBeNull();
  });
  it("telefone: +55 e dígitos", () => {
    expect(normalizePixKey("telefone", "(11) 91234-5678")).toBe("+5511912345678");
    expect(normalizePixKey("telefone", "+55 11 91234-5678")).toBe("+5511912345678");
    expect(normalizePixKey("telefone", "+1 415 555 2671")).toBeNull();
    expect(normalizePixKey("telefone", "abc")).toBeNull();
  });
  it("aleatória: UUID de 32 a 36 caracteres", () => {
    const u = "123e4567-e89b-12d3-a456-426614174000";
    expect(normalizePixKey("aleatoria", u)).toBe(u);
    expect(normalizePixKey("aleatoria", u.replace(/-/g, ""))).toBe(u.replace(/-/g, ""));
    expect(normalizePixKey("aleatoria", u + "0")).toBeNull();
    expect(normalizePixKey("aleatoria", "123e4567")).toBeNull();
    expect(normalizePixKey("aleatoria", "z".repeat(36))).toBeNull();
  });
  it("stripControl remove controles e quebras", () => {
    expect(stripControl("a\u0000b\nc\t\td\u007f ")).toBe("ab c d");
  });
});

describe("settingsSchema: sinal e Pix", () => {
  const base = {
    whatsappNumber: "(11) 91145-4427", orderDeadline: "", lastDeliveryDate: "", minLeadDays: 3,
    noticeLines: [], depositPercent: 50, pixKeyType: "", pixKey: "", pixHolder: "", paymentNote: "",
  };
  const U = "123e4567-e89b-12d3-a456-426614174000";
  const parse = (o: object) => settingsSchema.safeParse({ ...base, ...o });

  it("percentual: inteiro 0–100", () => {
    for (const p of [0, 1, 30, 50, 100]) expect(parse({ depositPercent: p }).success).toBe(true);
    for (const p of [-1, 101, 33.5, NaN, "50", null]) expect(parse({ depositPercent: p }).success, String(p)).toBe(false);
  });
  it("sem chave: ok, e o tipo é zerado", () => {
    const r = parse({ pixKeyType: "cpf", pixKey: "   " });
    expect(r.success && r.data.pixKey).toBe("");
    expect(r.success && r.data.pixKeyType).toBe("");
  });
  it("chave aleatória válida é aceita", () => {
    const r = parse({ pixKeyType: "aleatoria", pixKey: U.toUpperCase(), pixHolder: "  DoZé  " });
    expect(r.success && r.data.pixKey).toBe(U);
    expect(r.success && r.data.pixHolder).toBe("DoZé");
  });
  it("tipo que não casa com a chave dá erro amigável", () => {
    const r = parse({ pixKeyType: "cpf", pixKey: U });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toMatch(/CPF/);
    expect(parse({ pixKeyType: "email", pixKey: "12345678909" }).success).toBe(false);
    expect(parse({ pixKeyType: "telefone", pixKey: "123" }).success).toBe(false);
  });
  it("chave sem tipo e tipo desconhecido são recusados", () => {
    expect(parse({ pixKeyType: "", pixKey: "12345678909" }).success).toBe(false);
    expect(parse({ pixKeyType: "boleto", pixKey: "x" }).success).toBe(false);
  });
  it("strings enormes são recusadas", () => {
    expect(parse({ pixKeyType: "email", pixKey: "a".repeat(200) + "@x.com" }).success).toBe(false);
    expect(parse({ pixHolder: "n".repeat(81) }).success).toBe(false);
    expect(parse({ paymentNote: "n".repeat(301) }).success).toBe(false);
    expect(parse({ paymentNote: "n".repeat(300) }).success).toBe(true);
    expect(parse({ paymentNote: "n".repeat(5_000_000) }).success).toBe(false);
  });
  it("caracteres de controle são removidos", () => {
    const r = parse({ pixHolder: "Do\u0000Zé\nConf\u0007", paymentNote: "a\r\nb\u001b" });
    expect(r.success && r.data.pixHolder).toBe("DoZé Conf");
    expect(r.success && r.data.paymentNote).toBe("a b");
    const k = parse({ pixKeyType: "aleatoria", pixKey: `${U}\u0000` });
    expect(k.success && k.data.pixKey).toBe(U);
  });
});

describe("padrões e exposição pública", () => {
  it("padrão: 50% e sem chave Pix", () => {
    expect(defaultSettings).toMatchObject({ depositPercent: 50, pixKey: "", pixKeyType: "", pixHolder: "", paymentNote: "" });
  });
  it("toPublicCatalog expõe as configurações de pagamento", () => {
    const pub = toPublicCatalog({ categories: [], settings: { ...defaultSettings, depositPercent: 30 } });
    expect(pub.settings.depositPercent).toBe(30);
  });
});
