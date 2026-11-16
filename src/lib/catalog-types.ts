/** Tipos do cardápio. Preços SEMPRE em centavos inteiros. */

export interface CatalogOption {
  id: number;
  label: string;
  priceCents: number;
}

export interface CatalogItem {
  /** Slug estável (usado nas chaves do carrinho). */
  id: string;
  name: string;
  description: string | null;
  /** Preço do item; se houver opções, é o menor preço entre elas ("a partir de"). */
  priceCents: number;
  imageUrl: string | null;
  emoji: string | null;
  glutenFree: boolean;
  options: CatalogOption[];
}

export interface CatalogCategory {
  /** Slug da categoria (âncora da página). */
  id: string;
  title: string;
  emoji: string;
  tone: "default" | "festive";
  note: string | null;
  items: CatalogItem[];
}

import type { PixKeyTypeOrEmpty } from "@/lib/payment";

export interface SiteSettings {
  whatsappNumber: string;
  instagramHandle: string;
  /** "AAAA-MM-DD" ou null (sem limite). Depois desta data os pedidos encerram. */
  orderDeadline: string | null;
  /** "AAAA-MM-DD" ou null. Última data de entrega/retirada. */
  lastDeliveryDate: string | null;
  minLeadDays: number;
  noticeLines: string[];
  /** Sinal antecipado (0–100). 0 desativa. */
  depositPercent: number;
  /** Chave Pix para o sinal ("" = ainda não cadastrada). */
  pixKey: string;
  pixKeyType: PixKeyTypeOrEmpty;
  /** Nome do favorecido do Pix (opcional). */
  pixHolder: string;
  /** Texto livre curto sobre o pagamento (opcional). */
  paymentNote: string;
}

export interface Catalog {
  categories: CatalogCategory[];
  settings: SiteSettings;
}

// ---------- Visão do painel (inclui itens escondidos e ids do banco) ----------

export interface AdminItem {
  id: number;
  slug: string;
  categoryId: number;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  emoji: string | null;
  glutenFree: boolean;
  active: boolean;
  options: CatalogOption[];
}

export interface AdminCategory {
  id: number;
  slug: string;
  name: string;
  note: string | null;
  emoji: string;
  tone: "default" | "festive";
  items: AdminItem[];
}

export interface AdminData {
  categories: AdminCategory[];
  settings: SiteSettings;
}
