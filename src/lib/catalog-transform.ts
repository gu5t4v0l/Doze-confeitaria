import type { AdminData, Catalog } from "@/lib/catalog-types";

/** Visão pública: só itens ativos; categoria sem itens ativos some. */
export function toPublicCatalog(data: AdminData): Catalog {
  const categories = data.categories
    .map((c) => ({
      id: c.slug,
      title: c.name,
      emoji: c.emoji,
      tone: c.tone,
      note: c.note,
      items: c.items
        .filter((i) => i.active)
        .map((i) => ({
          id: i.slug,
          name: i.name,
          description: i.description,
          priceCents: i.priceCents,
          imageUrl: i.imageUrl,
          emoji: i.emoji,
          glutenFree: i.glutenFree,
          options: i.options,
        })),
    }))
    .filter((c) => c.items.length > 0);
  return { categories, settings: data.settings };
}
