import { describe, it, expect } from "vitest";
import { categorySchema, itemSchema, normalizeWhatsapp, settingsSchema } from "@/lib/admin/schemas";
import { blobStoreHost, isAllowedBlobUrl } from "@/lib/blob-url";
import { swapped } from "@/lib/admin/ordering";
import { slugify, uniqueSlug } from "@/lib/slug";
import { fitWithin } from "@/lib/image-resize";
import { toPublicCatalog } from "@/lib/catalog-transform";
import { defaultSettings } from "@/data/menu";
import type { AdminData, AdminItem } from "@/lib/catalog-types";

const STORE = "abc123def.public.blob.vercel-storage.com";
const goodUrl = `https://${STORE}/itens/bolo-x9Yz.webp`;

const validItem = {
  categoryId: 1,
  name: "Bolo de cenoura",
  description: "",
  priceCents: 5900,
  glutenFree: false,
  imageUrl: null,
  options: [],
};

describe("blob url", () => {
  it("deriva o host do token sem usar o segredo", () => {
    expect(blobStoreHost("vercel_blob_rw_AbC123DeF_segredoSegredo")).toBe("abc123def.public.blob.vercel-storage.com");
    expect(blobStoreHost("lixo")).toBeNull();
    expect(blobStoreHost(undefined)).toBeNull();
  });
  it("aceita só https do nosso store, dentro de itens/", () => {
    expect(isAllowedBlobUrl(goodUrl, STORE)).toBe(true);
    for (const bad of [
      `http://${STORE}/itens/a.webp`,
      `https://outro.public.blob.vercel-storage.com/itens/a.webp`,
      `https://${STORE}.evil.com/itens/a.webp`,
      `https://evil.com/${STORE}/itens/a.webp`,
      `https://${STORE}/outra-pasta/a.webp`,
      `https://${STORE}/itens/../segredo.webp`,
      `https://user:pw@${STORE}/itens/a.webp`,
      `https://${STORE}:8443/itens/a.webp`,
      `javascript:alert(1)`,
      "data:image/png;base64,AAAA",
      "/itens/a.webp",
      "",
    ]) {
      expect(isAllowedBlobUrl(bad, STORE), bad).toBe(false);
    }
  });
  it("sem store conhecido, ainda exige o domínio de Blob público", () => {
    expect(isAllowedBlobUrl(goodUrl, null)).toBe(true);
    expect(isAllowedBlobUrl("https://evil.com/itens/a.webp", null)).toBe(false);
  });
});

describe("itemSchema", () => {
  it("aceita item válido e apara espaços", () => {
    const r = itemSchema.safeParse({ ...validItem, name: "  Bolo  " });
    expect(r.success && r.data.name).toBe("Bolo");
  });
  it.each([
    ["nome vazio", { name: "   " }],
    ["nome enorme", { name: "a".repeat(81) }],
    ["descrição enorme", { description: "a".repeat(301) }],
    ["preço negativo", { priceCents: -1 }],
    ["preço decimal", { priceCents: 19.9 }],
    ["preço NaN", { priceCents: NaN }],
    ["preço texto", { priceCents: "19" }],
    ["preço acima de R$ 10.000", { priceCents: 1_000_001 }],
    ["categoria inválida", { categoryId: 0 }],
    ["categoria decimal", { categoryId: 1.5 }],
    ["glutenFree não booleano", { glutenFree: "sim" }],
    ["foto de outro domínio", { imageUrl: "https://evil.com/itens/a.webp" }],
    ["caractere de controle", { name: "a\u0000b" }],
    ["id negativo", { id: -3 }],
  ])("rejeita %s", (_n, patch) => {
    expect(itemSchema.safeParse({ ...validItem, ...patch }).success).toBe(false);
  });
  it("aceita preço 0 e o teto de R$ 10.000,00", () => {
    expect(itemSchema.safeParse({ ...validItem, priceCents: 0 }).success).toBe(true);
    expect(itemSchema.safeParse({ ...validItem, priceCents: 1_000_000 }).success).toBe(true);
  });
  it("opções: 0 ou pelo menos 2; rótulo e preço válidos", () => {
    const opt = (label: string, priceCents: number) => ({ label, priceCents });
    expect(itemSchema.safeParse({ ...validItem, options: [opt("A", 100)] }).success).toBe(false);
    expect(itemSchema.safeParse({ ...validItem, options: [opt("A", 100), opt("B", 200)] }).success).toBe(true);
    expect(itemSchema.safeParse({ ...validItem, options: [opt("", 100), opt("B", 200)] }).success).toBe(false);
    expect(itemSchema.safeParse({ ...validItem, options: [opt("A", -1), opt("B", 200)] }).success).toBe(false);
    expect(itemSchema.safeParse({ ...validItem, options: Array.from({ length: 21 }, (_, i) => opt(`o${i}`, 1)) }).success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("valida tamanhos", () => {
    expect(categorySchema.safeParse({ name: "Tortas", note: "", emoji: "🥧" }).success).toBe(true);
    expect(categorySchema.safeParse({ name: "", note: "", emoji: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "a".repeat(41), note: "", emoji: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "ok", note: "a".repeat(81), emoji: "" }).success).toBe(false);
  });
});

describe("settingsSchema e WhatsApp", () => {
  const ok = { whatsappNumber: "(11) 91145-4427", orderDeadline: "2026-12-19", lastDeliveryDate: "2026-12-24", minLeadDays: 3, noticeLines: ["a"], depositPercent: 50, pixKeyType: "", pixKey: "", pixHolder: "", paymentNote: "" };
  it("normaliza o número para dígitos com DDI 55", () => {
    expect(normalizeWhatsapp("(11) 91145-4427")).toBe("5511911454427");
    expect(normalizeWhatsapp("+55 11 91145-4427")).toBe("5511911454427");
    expect(normalizeWhatsapp("1133334444")).toBe("551133334444");
    for (const bad of ["", "123", "5511", "abc", "+1 415 555 2671", "551191145442799"]) {
      expect(normalizeWhatsapp(bad), bad).toBeNull();
    }
    const r = settingsSchema.safeParse(ok);
    expect(r.success && r.data.whatsappNumber).toBe("5511911454427");
  });
  it("datas ISO válidas ou vazias; entrega não pode ser antes do limite de pedidos", () => {
    expect(settingsSchema.safeParse({ ...ok, orderDeadline: "", lastDeliveryDate: "" }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...ok, orderDeadline: "2026-02-30" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, orderDeadline: "19/12/2026" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, orderDeadline: "2026-12-25", lastDeliveryDate: "2026-12-24" }).success).toBe(false);
  });
  it("antecedência inteira 0..60 e avisos limitados", () => {
    expect(settingsSchema.safeParse({ ...ok, minLeadDays: -1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, minLeadDays: 61 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, minLeadDays: 1.5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, noticeLines: Array(9).fill("x") }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, noticeLines: ["a".repeat(201)] }).success).toBe(false);
  });
});

describe("slug, ordem e imagem", () => {
  it("slugify", () => {
    expect(slugify("Pão de Mel 2kg!")).toBe("pao-de-mel-2kg");
    expect(slugify("  ")).toBe("item");
    expect(slugify("Delícia de Uva 1kg")).toBe("delicia-de-uva-1kg");
  });
  it("uniqueSlug acrescenta sufixo", () => {
    expect(uniqueSlug("bolo", ["bolo", "bolo-2"])).toBe("bolo-3");
    expect(uniqueSlug("bolo", [])).toBe("bolo");
  });
  it("swapped troca com o vizinho e respeita as pontas", () => {
    expect(swapped([1, 2, 3], 2, "up")).toEqual([2, 1, 3]);
    expect(swapped([1, 2, 3], 2, "down")).toEqual([1, 3, 2]);
    expect(swapped([1, 2, 3], 1, "up")).toEqual([1, 2, 3]);
    expect(swapped([1, 2, 3], 3, "down")).toEqual([1, 2, 3]);
    expect(swapped([1, 2, 3], 9, "up")).toBeNull();
  });
  it("fitWithin: lado maior ~1200, nunca amplia", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 900, height: 1200 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1).height).toBe(1);
  });
});

describe("visão pública do cardápio", () => {
  const item = (id: number, active: boolean): AdminItem => ({
    id, slug: `i${id}`, categoryId: 1, name: `Item ${id}`, description: null, priceCents: 100, imageUrl: null,
    emoji: null, glutenFree: false, active, options: [],
  });
  const data: AdminData = {
    settings: defaultSettings,
    categories: [
      { id: 1, slug: "a", name: "A", note: null, emoji: "x", tone: "default", items: [item(1, true), item(2, false)] },
      { id: 2, slug: "b", name: "B", note: null, emoji: "x", tone: "default", items: [item(3, false)] },
    ],
  };
  it("esconde itens inativos e categorias sem itens ativos", () => {
    const pub = toPublicCatalog(data);
    expect(pub.categories.map((c) => c.id)).toEqual(["a"]);
    expect(pub.categories[0].items.map((i) => i.id)).toEqual(["i1"]);
  });
});
