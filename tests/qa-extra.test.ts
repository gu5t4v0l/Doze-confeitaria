import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMoneyToCents } from "@/lib/money";
import { isAllowedBlobUrl } from "@/lib/blob-url";
import { itemSchema, normalizeWhatsapp, settingsSchema } from "@/lib/admin/schemas";
import { getDateBounds, isOrdersClosed, validateDesiredDate, type OrderRules } from "@/lib/dates";
import { buildCatalogIndex, getLines, sanitizeCart } from "@/lib/cart";
import { toPublicCatalog } from "@/lib/catalog-transform";
import { defaultSettings } from "@/data/menu";
import type { AdminData } from "@/lib/catalog-types";

// ---------------------------------------------------------------- mutations (fronteira: banco)
interface Call {
  text: string;
  values: unknown[];
}
const calls: Call[] = [];
const transactions: Call[][] = [];
let responder: (text: string) => unknown[] = () => [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => {
  const make = (strings: TemplateStringsArray, values: unknown[]): Call => ({ text: strings.join("?"), values });
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const call = make(strings, values);
      calls.push(call);
      // objeto "thenable": serve tanto para await quanto para sql.transaction([...])
      return Object.assign(Promise.resolve(responder(call.text)), { __call: call });
    },
    {
      transaction: async (queries: Array<{ __call: Call }>) => {
        transactions.push(queries.map((q) => q.__call));
        return [];
      },
    },
  );
  return { getDb: () => sql };
});

const STORE = "abc123def.public.blob.vercel-storage.com";

describe("saveItem: diferença de opções no update", () => {
  beforeEach(() => {
    calls.length = 0;
    transactions.length = 0;
  });

  const base = {
    id: 8,
    categoryId: 2,
    name: "Bits",
    description: "",
    priceCents: 0,
    glutenFree: false,
    imageUrl: null,
  };

  function setup(existingOptionIds: number[], currentImage: string | null = null, currentCat = 2) {
    responder = (t) => {
      if (t.includes("from categories where id")) return [{ id: 2 }];
      if (t.includes("select category_id, image_url from items")) return [{ category_id: currentCat, image_url: currentImage }];
      if (t.includes("select id from item_options")) return existingOptionIds.map((id) => ({ id }));
      return [];
    };
  }

  it("preserva ids, atualiza preço, insere nova e remove a que sumiu", async () => {
    setup([1, 2]);
    const { saveItem } = await import("@/lib/admin/mutations");
    await saveItem({
      ...base,
      options: [
        { id: 2, label: "Recheio", priceCents: 2750 },
        { label: "Nozes", priceCents: 3000 },
      ],
    });
    const [tx] = transactions;
    expect(tx).toHaveLength(4);
    const [itemUpdate, del, upd, ins] = tx;
    expect(itemUpdate.values).toContain(2750); // preço do item = menor preço das opções
    expect(del.values[1]).toEqual([2]); // só a opção 2 é mantida (a 1 é apagada)
    expect(upd.values).toEqual([[2], ["Recheio"], [2750], [0], 8]);
    expect(ins.values).toEqual([8, ["Nozes"], [3000], [1]]);
  });

  it("rejeita opção de outro item/inexistente sem escrever nada", async () => {
    setup([1, 2]);
    const { saveItem, UserError } = await import("@/lib/admin/mutations");
    await expect(
      saveItem({ ...base, options: [{ id: 99, label: "X", priceCents: 1 }, { label: "Y", priceCents: 2 }] }),
    ).rejects.toBeInstanceOf(UserError);
    expect(transactions).toHaveLength(0);
  });

  it("sem opções: remove todas (keep vazio) e usa o preço simples", async () => {
    setup([1, 2]);
    const { saveItem } = await import("@/lib/admin/mutations");
    await saveItem({ ...base, priceCents: 2750, options: [] });
    const [itemUpdate, del, upd, ins] = transactions[0];
    expect(itemUpdate.values).toContain(2750);
    expect(del.values[1]).toEqual([]);
    expect(upd.values.slice(0, 4)).toEqual([[], [], [], []]);
    expect(ins.values[1]).toEqual([]);
  });

  it("devolve a foto antiga só quando ela mudou", async () => {
    const old = `https://${STORE}/itens/a.webp`;
    const next = `https://${STORE}/itens/b.webp`;
    const { saveItem } = await import("@/lib/admin/mutations");
    setup([], old);
    expect((await saveItem({ ...base, priceCents: 100, options: [], imageUrl: next })).staleImageUrl).toBe(old);
    setup([], old);
    expect((await saveItem({ ...base, priceCents: 100, options: [], imageUrl: old })).staleImageUrl).toBeNull();
    setup([], old);
    expect((await saveItem({ ...base, priceCents: 100, options: [], imageUrl: null })).staleImageUrl).toBe(old);
    setup([], null);
    expect((await saveItem({ ...base, priceCents: 100, options: [], imageUrl: next })).staleImageUrl).toBeNull();
  });

  it("item inexistente vira UserError (apagado em outra aba)", async () => {
    responder = (t) => (t.includes("from categories where id") ? [{ id: 2 }] : []);
    const { saveItem, UserError } = await import("@/lib/admin/mutations");
    await expect(saveItem({ ...base, priceCents: 100, options: [] })).rejects.toBeInstanceOf(UserError);
  });
});

describe("foto compartilhada entre itens", () => {
  const url = `https://${STORE}/itens/shared.webp`;
  it("deleteItem devolve a foto só se nenhum outro item a usa", async () => {
    const { deleteItem } = await import("@/lib/admin/mutations");
    calls.length = 0;
    responder = (t) => (t.includes("delete from items") ? [{ image_url: url }] : t.includes("image_url =") ? [{ "?column?": 1 }] : []);
    expect(await deleteItem(5)).toBeNull();
    const q = calls.find((c) => c.text.includes("image_url ="))!;
    expect(q.text).toContain("id <>");
    expect(q.values).toEqual([url, 5]);
    responder = (t) => (t.includes("delete from items") ? [{ image_url: url }] : []);
    expect(await deleteItem(5)).toBe(url);
  });
  it("saveItem não marca foto antiga como apagável se outro item a usa", async () => {
    const { saveItem } = await import("@/lib/admin/mutations");
    const input = { id: 8, categoryId: 2, name: "Bits", description: "", priceCents: 100, glutenFree: false, imageUrl: null, options: [] };
    const mk = (shared: boolean) => (t: string) =>
      t.includes("from categories where id") ? [{ id: 2 }]
      : t.includes("select category_id, image_url") ? [{ category_id: 2, image_url: url }]
      : t.includes("from item_options where item_id") ? []
      : t.includes("image_url =") && shared ? [{ x: 1 }] : [];
    responder = mk(true);
    expect((await saveItem(input)).staleImageUrl).toBeNull();
    responder = mk(false);
    expect((await saveItem(input)).staleImageUrl).toBe(url);
  });
});

describe("deleteCategory", () => {
  it("recusa categoria com itens e não apaga", async () => {
    calls.length = 0;
    responder = (t) => (t.includes("count(*)") ? [{ n: 3 }] : []);
    const { deleteCategory, UserError } = await import("@/lib/admin/mutations");
    await expect(deleteCategory(1)).rejects.toBeInstanceOf(UserError);
    expect(calls.some((c) => c.text.includes("delete from categories"))).toBe(false);
  });
  it("apaga categoria vazia; id inexistente vira UserError", async () => {
    const { deleteCategory, UserError } = await import("@/lib/admin/mutations");
    responder = (t) => (t.includes("count(*)") ? [{ n: 0 }] : t.includes("delete from categories") ? [{ id: 1 }] : []);
    await expect(deleteCategory(1)).resolves.toBeUndefined();
    responder = (t) => (t.includes("count(*)") ? [{ n: 0 }] : []);
    await expect(deleteCategory(1)).rejects.toBeInstanceOf(UserError);
  });
});

// ---------------------------------------------------------------- URL do blob
describe("isAllowedBlobUrl: hosts maliciosos", () => {
  it.each([
    "https://evil.com/.public.blob.vercel-storage.com/itens/a.webp",
    `https://${STORE}.evil.com/itens/a.webp`,
    `https://x.public.blob.vercel-storage.com.evil.com/itens/a.webp`,
    `https://evil.com/x.public.blob.vercel-storage.com/itens/a.webp`,
    `https://evil.com#@${STORE}/itens/a.webp`,
    `https://evil.com\\@${STORE}/itens/a.webp`,
    `https://${STORE}@evil.com/itens/a.webp`,
    `https://evil.com?.public.blob.vercel-storage.com/itens/a.webp`,
    `https://.public.blob.vercel-storage.com/itens/a.webp`,
    `https://public.blob.vercel-storage.com/itens/a.webp`,
    `https://${STORE}/itens/%2e%2e/segredo.webp`,
    `https://${STORE}//itens/a.webp`,
    `https://${STORE}/Itens/a.webp`,
    `HTTP://${STORE}/itens/a.webp`,
    `https://${STORE.toUpperCase()}.evil.com/itens/a.webp`,
    `//${STORE}/itens/a.webp`,
    `ftp://${STORE}/itens/a.webp`,
    `file:///etc/passwd`,
  ])("rejeita %s", (u) => {
    expect(isAllowedBlobUrl(u, STORE)).toBe(false);
    expect(isAllowedBlobUrl(u, null)).toBe(false);
  });

  it("aceita o store com host em maiúsculas (URL normaliza) e path com subpastas de itens/", () => {
    expect(isAllowedBlobUrl(`https://${STORE.toUpperCase()}/itens/a.webp`, STORE)).toBe(true);
    expect(isAllowedBlobUrl(`https://${STORE}/itens/sub/a.webp?x=1`, STORE)).toBe(true);
  });

  it("o schema do item usa a mesma regra (foto maliciosa é rejeitada)", () => {
    const item = { categoryId: 1, name: "a", description: "", priceCents: 1, glutenFree: false, options: [] };
    for (const imageUrl of ["https://evil.com/.public.blob.vercel-storage.com/itens/a.webp", "x".repeat(501)]) {
      expect(itemSchema.safeParse({ ...item, imageUrl }).success).toBe(false);
    }
  });
});

// ---------------------------------------------------------------- preço pt-BR absurdo
describe("parseMoneyToCents: entradas absurdas", () => {
  it.each([
    "1.2.3",
    "1,000.00",
    "1.23,4",
    ".5",
    "5.",
    "1,5,",
    "--5",
    "+5",
    "０１２",
    "٣٤",
    "0x10",
    "Infinity",
    "1e9",
    "null",
    "undefined",
    "9".repeat(400),
    "5,5,5",
    "5;5",
    "'; drop table items;--",
    "<script>1</script>",
    "1.000.00",
    "1000.000.000.000.000.000.000,00",
  ])("rejeita %j", (s) => {
    expect(parseMoneyToCents(s)).toBeNull();
  });

  it("acima do teto passa no parse mas o schema barra (R$ 10.000,01)", () => {
    const cents = parseMoneyToCents("10.000,01");
    expect(cents).toBe(1_000_001);
    const item = { categoryId: 1, name: "a", description: "", glutenFree: false, imageUrl: null, options: [] };
    expect(itemSchema.safeParse({ ...item, priceCents: cents }).success).toBe(false);
  });

  it("valores enormes mas seguros não viram NaN/Infinity", () => {
    const v = parseMoneyToCents("90.071.992.547.409,00");
    expect(v === null || Number.isSafeInteger(v)).toBe(true);
    expect(parseMoneyToCents("999999999999999999999999")).toBeNull();
  });

  it("espaços e 'R$' são ignorados (o campo do painel já filtra tudo que não é dígito , .)", () => {
    expect(parseMoneyToCents("1 000")).toBe(100000);
    expect(parseMoneyToCents("R$R$5")).toBe(500);
  });

  it("zeros à esquerda e centavos com um dígito", () => {
    expect(parseMoneyToCents("007,5")).toBe(750);
    expect(parseMoneyToCents("0,05")).toBe(5);
  });
});

describe("normalizeWhatsapp: entradas absurdas", () => {
  it.each(["+55", "++5511911454427", "55", "0011911454427", "(11) 9114-5442-7-1", "5511911454427 ".repeat(3), "٥٥١١٩١١٤٥٤٤٢٧"])(
    "rejeita %j",
    (s) => expect(normalizeWhatsapp(s)).toBeNull(),
  );
  it("settingsSchema rejeita WhatsApp gigante", () => {
    const ok = { orderDeadline: "", lastDeliveryDate: "", minLeadDays: 0, noticeLines: [], depositPercent: 50, pixKeyType: "", pixKey: "", pixHolder: "", paymentNote: "" };
    expect(settingsSchema.safeParse({ ...ok, whatsappNumber: "1".repeat(31) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------- datas com configurações do banco
describe("regras de data vindas das configurações (cenário do painel)", () => {
  const rules = (o: Partial<OrderRules> = {}): OrderRules => ({
    orderDeadline: "2026-12-19",
    lastDeliveryDate: "2026-12-24",
    minLeadDays: 3,
    ...o,
  });

  it("data limite = ontem encerra; = hoje ainda aceita; voltar para 19/12 reabre", () => {
    expect(isOrdersClosed("2026-11-15", rules({ orderDeadline: "2026-11-14" }))).toBe(true);
    expect(isOrdersClosed("2026-11-15", rules({ orderDeadline: "2026-11-15" }))).toBe(false);
    expect(isOrdersClosed("2026-11-15", rules())).toBe(false);
  });
  it("antecedência 0 aceita hoje; 60 dias empurra o mínimo", () => {
    expect(getDateBounds("2026-11-15", rules({ minLeadDays: 0 })).min).toBe("2026-11-15");
    expect(validateDesiredDate("2026-11-15", "2026-11-15", rules({ minLeadDays: 0 }))).toBeNull();
    expect(getDateBounds("2026-11-15", rules({ minLeadDays: 60 })).min).toBe("2027-01-14");
  });
  it("passa de ano e de fevereiro bissexto", () => {
    expect(getDateBounds("2027-12-30", rules({ minLeadDays: 3 })).min).toBe("2028-01-02");
    expect(getDateBounds("2028-02-27", rules({ minLeadDays: 2 })).min).toBe("2028-02-29");
  });
  it("entrega antes do mínimo, depois do máximo e lixo viram mensagem em pt-BR", () => {
    expect(validateDesiredDate("2026-11-16", "2026-11-15", rules())).toMatch(/Prazo mínimo de 3 dias/);
    expect(validateDesiredDate("2026-12-25", "2026-11-15", rules())).toMatch(/somente até 24\/12\/2026/);
    expect(validateDesiredDate("2026-13-45", "2026-11-15", rules())).toMatch(/data válida/);
  });
  it("sem datas configuradas: nunca encerra e sem teto", () => {
    const open = rules({ orderDeadline: null, lastDeliveryDate: null });
    expect(isOrdersClosed("2099-01-01", open)).toBe(false);
    expect(validateDesiredDate("2099-01-01", "2026-11-15", open)).toBeNull();
  });
});

// ---------------------------------------------------------------- carrinho x catálogo mudando
describe("carrinho guardado x catálogo alterado no painel", () => {
  const data = (active: boolean, price: number, opts: Array<{ id: number; label: string; priceCents: number }>): AdminData => ({
    settings: defaultSettings,
    categories: [
      {
        id: 1, slug: "c", name: "C", note: null, emoji: "x", tone: "default",
        items: [
          { id: 1, slug: "pudim", categoryId: 1, name: "Pudim", description: null, priceCents: price, imageUrl: null, emoji: null, glutenFree: false, active, options: [] },
          { id: 2, slug: "bits", categoryId: 1, name: "Bits", description: null, priceCents: 0, imageUrl: null, emoji: null, glutenFree: false, active: true, options: opts },
        ],
      },
    ],
  });
  const stored = { pudim: 2, "bits~1": 1, "bits~2": 1, __proto__x: 3 };

  it("preço novo vale; opção removida e item escondido são descartados", () => {
    const idx = buildCatalogIndex(toPublicCatalog(data(true, 5500, [{ id: 2, label: "B", priceCents: 2750 }])).categories);
    const cart = sanitizeCart(stored, idx);
    expect(Object.keys(cart).sort()).toEqual(["bits~2", "pudim"]);
    expect(getLines(cart, idx).reduce((s, l) => s + l.totalCents, 0)).toBe(2 * 5500 + 2750);

    const hidden = buildCatalogIndex(toPublicCatalog(data(false, 5500, [{ id: 2, label: "B", priceCents: 2750 }])).categories);
    expect(Object.keys(sanitizeCart(stored, hidden))).toEqual(["bits~2"]);
  });
  it("opção renumerada com o mesmo id mantém a linha; id novo não herda quantidade", () => {
    const idx = buildCatalogIndex(toPublicCatalog(data(true, 100, [{ id: 3, label: "Nova", priceCents: 1 }, { id: 2, label: "B", priceCents: 9 }])).categories);
    const cart = sanitizeCart({ "bits~2": 4, "bits~3": 1 }, idx);
    expect(cart).toEqual({ "bits~2": 4, "bits~3": 1 });
    expect(getLines(cart, idx).find((l) => l.key === "bits~2")?.unitPriceCents).toBe(9);
  });
});
