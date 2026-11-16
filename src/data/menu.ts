/**
 * Dados INICIAIS e de EMERGÊNCIA da DoZé Confeitaria.
 *
 * - `npm run db:seed` copia estes dados para o banco (só o que ainda não existe).
 * - Se o banco estiver fora do ar, o site mostra este cardápio em vez de quebrar.
 *
 * O cardápio real (itens, preços, fotos, datas) é editado pela dona em /admin.
 * Preços em CENTAVOS inteiros (4900 = R$ 49,00).
 */
import type { Catalog, CatalogCategory, CatalogItem, SiteSettings } from "../lib/catalog-types";

export const siteConfig = {
  name: "DoZé Confeitaria",
  tagline: "Feito com amor",
  description: "Doces feitos à mão, sob encomenda",
  instagramHandle: "Doze_confeitaria",
};

export const defaultSettings: SiteSettings = {
  whatsappNumber: "5511911454427",
  instagramHandle: siteConfig.instagramHandle,
  orderDeadline: "2026-12-19",
  lastDeliveryDate: "2026-12-24",
  minLeadDays: 3,
  noticeLines: [
    "Trabalhamos somente por encomenda com prazo mínimo de 3 dias de antecedência.",
    "Pedidos até dia 19/12.",
    "Entrega e retirada até dia 24/12.",
  ],
  // Sinal de 50% por Pix. A chave Pix é cadastrada pela dona em /admin → Configurações.
  depositPercent: 50,
  pixKey: "",
  pixKeyType: "",
  pixHolder: "",
  paymentNote: "",
};

function simple(id: string, name: string, priceCents: number, emoji: string): CatalogItem {
  return {
    id,
    name,
    description: null,
    priceCents,
    imageUrl: null,
    emoji,
    glutenFree: false,
    options: [],
  };
}

export const seedCategories: CatalogCategory[] = [
  {
    id: "cardapio",
    title: "Cardápio",
    emoji: "🍰",
    tone: "default",
    note: "Temos opções sem glúten.",
    items: [
      simple("pudim-leite-condensado", "Pudim de leite condensado 900g", 4900, "🍮"),
      simple("delicia-de-uva", "Delícia de Uva 1kg", 7900, "🍇"),
      simple("bolo-de-brigadeiro", "Bolo de Brigadeiro 2kg", 11900, "🍫"),
      simple("bolo-de-cenoura-brigadeiro", "Bolo de Cenoura com cobertura de Brigadeiro", 5900, "🥕"),
      simple("bolo-de-morango-leite-condensado", "Bolo de Morango e Leite condensado 2kg", 12900, "🍓"),
      simple("bolo-de-prestigio", "Bolo de Prestígio 2kg", 11900, "🥥"),
      simple("torta-de-frango", "Torta de Frango", 6900, "🥧"),
    ],
  },
  {
    id: "natal",
    title: "Especial de Natal",
    emoji: "🎄",
    tone: "festive",
    note: null,
    items: [
      {
        ...simple("bits-de-panetone", "Bits de Panetone 200g", 1900, "🎄"),
        options: [
          { id: 1, label: "Tradicional", priceCents: 1900 },
          { id: 2, label: "Com recheio de doce de leite 200g", priceCents: 2500 },
        ],
      },
      simple("pao-de-mel", "Pão de mel", 1200, "🍯"),
    ],
  },
];

/** Cardápio estático usado como seed e como plano B. */
export function fallbackCatalog(): Catalog {
  return { categories: seedCategories, settings: defaultSettings };
}
