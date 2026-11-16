import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { fallbackCatalog, defaultSettings } from "@/data/menu";
import type { AdminCategory, AdminData, AdminItem, Catalog, SiteSettings } from "@/lib/catalog-types";
import { toPublicCatalog } from "@/lib/catalog-transform";
import { getDb } from "@/lib/db/client";
import { PIX_KEY_TYPES, sanitizeDepositPercent, type PixKeyTypeOrEmpty } from "@/lib/payment";

export const MENU_TAG = "menu";

function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function toPixKeyType(v: unknown): PixKeyTypeOrEmpty {
  return (PIX_KEY_TYPES as readonly string[]).includes(v as string) ? (v as PixKeyTypeOrEmpty) : "";
}

/** Lê tudo do banco (inclui itens escondidos). Datas vêm como texto: sem fuso. */
export async function loadAdminData(): Promise<AdminData> {
  const sql = getDb();
  const [cats, items, options, settingsRows] = await Promise.all([
    sql`select id, slug, name, note, emoji, tone from categories order by sort_order, id`,
    sql`select id, slug, category_id, name, description, price_cents, image_url, emoji, gluten_free, active
        from items order by sort_order, id`,
    sql`select id, item_id, label, price_cents from item_options order by sort_order, id`,
    sql`select whatsapp_number, instagram_handle, order_deadline::text as order_deadline,
               last_delivery_date::text as last_delivery_date, min_lead_days, notice_lines,
               deposit_percent, pix_key, pix_key_type, pix_holder, payment_note
        from settings where id = 1`,
  ]);

  const byItem = new Map<number, AdminItem["options"]>();
  for (const o of options) {
    const list = byItem.get(o.item_id as number) ?? [];
    list.push({ id: o.id as number, label: o.label as string, priceCents: o.price_cents as number });
    byItem.set(o.item_id as number, list);
  }
  const byCategory = new Map<number, AdminItem[]>();
  for (const i of items) {
    const item: AdminItem = {
      id: i.id as number,
      slug: i.slug as string,
      categoryId: i.category_id as number,
      name: i.name as string,
      description: (i.description as string | null) ?? null,
      priceCents: i.price_cents as number,
      imageUrl: (i.image_url as string | null) ?? null,
      emoji: (i.emoji as string | null) ?? null,
      glutenFree: i.gluten_free as boolean,
      active: i.active as boolean,
      options: byItem.get(i.id as number) ?? [],
    };
    const list = byCategory.get(item.categoryId) ?? [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }
  const categories: AdminCategory[] = cats.map((c) => ({
    id: c.id as number,
    slug: c.slug as string,
    name: c.name as string,
    note: (c.note as string | null) ?? null,
    emoji: c.emoji as string,
    tone: c.tone === "festive" ? "festive" : "default",
    items: byCategory.get(c.id as number) ?? [],
  }));

  const s = settingsRows[0];
  const settings: SiteSettings = s
    ? {
        whatsappNumber: s.whatsapp_number as string,
        instagramHandle: s.instagram_handle as string,
        orderDeadline: (s.order_deadline as string | null) ?? null,
        lastDeliveryDate: (s.last_delivery_date as string | null) ?? null,
        minLeadDays: s.min_lead_days as number,
        noticeLines: splitLines((s.notice_lines as string) ?? ""),
        depositPercent: sanitizeDepositPercent(s.deposit_percent),
        pixKey: ((s.pix_key as string | null) ?? "").trim(),
        pixKeyType: toPixKeyType(s.pix_key_type),
        pixHolder: ((s.pix_holder as string | null) ?? "").trim(),
        paymentNote: ((s.payment_note as string | null) ?? "").trim(),
      }
    : defaultSettings;
  return { categories, settings };
}

async function getCachedCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(MENU_TAG);
  cacheLife("hours");
  return toPublicCatalog(await loadAdminData());
}

/**
 * Cardápio público: do banco (em cache, invalidado pela tag "menu") ou, se o banco
 * falhar, o cardápio estático. No plano B a página vira dinâmica (connection) para
 * tentar o banco de novo na próxima visita, em vez de congelar o fallback.
 */
export async function getPublicCatalog(): Promise<Catalog> {
  let catalog: Catalog | null = null;
  try {
    catalog = await getCachedCatalog();
  } catch (e) {
    console.error("[cardápio] banco indisponível, usando cardápio estático:", e instanceof Error ? e.message : e);
  }
  if (catalog) return catalog;
  await connection();
  return fallbackCatalog();
}
