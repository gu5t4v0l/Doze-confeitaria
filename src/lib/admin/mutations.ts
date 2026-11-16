import "server-only";
import { getDb } from "@/lib/db/client";
import type { CategoryInput, ItemInput, SettingsInput } from "@/lib/admin/schemas";
import { swapped, type Direction } from "@/lib/admin/ordering";
import { slugify, uniqueSlug } from "@/lib/slug";

/** Erro esperado: a mensagem (pt-BR) pode ser mostrada à dona. */
export class UserError extends Error {}


async function takenSlugs(table: "items" | "categories", base: string): Promise<string[]> {
  const sql = getDb();
  const like = `${base}%`; // slugs só têm [a-z0-9-]: sem curingas
  const rows =
    table === "items"
      ? await sql`select slug from items where slug like ${like}`
      : await sql`select slug from categories where slug like ${like}`;
  return rows.map((r) => r.slug as string);
}

/** Outro item (id diferente) ainda usa esta foto? Então o arquivo do Blob não pode ser apagado. */
async function imageUsedByOtherItem(url: string, exceptId: number): Promise<boolean> {
  const rows = await getDb()`select 1 from items where image_url = ${url} and id <> ${exceptId} limit 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------- itens

/** Cria ou atualiza o item e suas opções. Devolve a foto antiga a apagar (se trocou e nenhum outro item a usa). */
export async function saveItem(input: ItemInput): Promise<{ id: number; staleImageUrl: string | null }> {
  const sql = getDb();
  const cat = await sql`select id from categories where id = ${input.categoryId}`;
  if (cat.length === 0) throw new UserError("Categoria não encontrada.");

  const price = input.options.length ? Math.min(...input.options.map((o) => o.priceCents)) : input.priceCents;
  const description = input.description || null;

  if (input.id === undefined) {
    const base = slugify(input.name);
    const slug = uniqueSlug(base, await takenSlugs("items", base));
    const labels = input.options.map((o) => o.label);
    const prices = input.options.map((o) => o.priceCents);
    const ords = input.options.map((_, i) => i);
    const inserted = await sql`
      with ins as (
        insert into items (slug, category_id, name, description, price_cents, image_url, gluten_free, active, sort_order)
        values (${slug}, ${input.categoryId}, ${input.name}, ${description}, ${price}, ${input.imageUrl},
                ${input.glutenFree}, true,
                coalesce((select max(sort_order) + 1 from items where category_id = ${input.categoryId}), 0))
        returning id
      ), opts as (
        insert into item_options (item_id, label, price_cents, sort_order)
        select ins.id, o.label, o.price, o.ord
        from ins cross join unnest(${labels}::text[], ${prices}::int[], ${ords}::int[]) as o(label, price, ord)
      )
      select id from ins`;
    return { id: inserted[0].id as number, staleImageUrl: null };
  }

  const itemId = input.id;
  const [current, existingOptions] = await Promise.all([
    sql`select category_id, image_url from items where id = ${itemId}`,
    sql`select id from item_options where item_id = ${itemId}`,
  ]);
  if (current.length === 0) throw new UserError("Item não encontrado. Ele pode ter sido apagado.");
  const existing = new Set(existingOptions.map((o) => o.id as number));
  for (const o of input.options) {
    if (o.id !== undefined && !existing.has(o.id)) throw new UserError("Opção não encontrada. Recarregue a página.");
  }
  const oldImage = (current[0].image_url as string | null) ?? null;
  const categoryChanged = current[0].category_id !== input.categoryId;

  const keep = input.options.flatMap((o) => (o.id !== undefined ? [o.id] : []));
  const toUpdate = input.options.flatMap((o, i) => (o.id !== undefined ? [{ ...o, id: o.id, ord: i }] : []));
  const toInsert = input.options.flatMap((o, i) => (o.id === undefined ? [{ ...o, ord: i }] : []));

  await sql.transaction([
    sql`update items set
          category_id = ${input.categoryId}, name = ${input.name}, description = ${description},
          price_cents = ${price}, image_url = ${input.imageUrl}, gluten_free = ${input.glutenFree},
          sort_order = case when ${categoryChanged}::boolean
            then coalesce((select max(sort_order) + 1 from items where category_id = ${input.categoryId}), 0)
            else sort_order end,
          updated_at = now()
        where id = ${itemId}`,
    sql`delete from item_options where item_id = ${itemId} and id <> all(${keep}::int[])`,
    sql`update item_options set label = u.label, price_cents = u.price, sort_order = u.ord
        from unnest(${toUpdate.map((o) => o.id)}::int[], ${toUpdate.map((o) => o.label)}::text[],
                    ${toUpdate.map((o) => o.priceCents)}::int[], ${toUpdate.map((o) => o.ord)}::int[])
             as u(id, label, price, ord)
        where item_options.id = u.id and item_options.item_id = ${itemId}`,
    sql`insert into item_options (item_id, label, price_cents, sort_order)
        select ${itemId}::int, o.label, o.price, o.ord
        from unnest(${toInsert.map((o) => o.label)}::text[], ${toInsert.map((o) => o.priceCents)}::int[],
                    ${toInsert.map((o) => o.ord)}::int[]) as o(label, price, ord)`,
  ]);
  const changed = oldImage && oldImage !== input.imageUrl ? oldImage : null;
  const stale = changed && !(await imageUsedByOtherItem(changed, itemId)) ? changed : null;
  return { id: itemId, staleImageUrl: stale };
}

export async function setItemActive(id: number, active: boolean): Promise<void> {
  const rows = await getDb()`update items set active = ${active}, updated_at = now() where id = ${id} returning id`;
  if (rows.length === 0) throw new UserError("Item não encontrado.");
}

export async function moveItem(id: number, dir: Direction): Promise<void> {
  const sql = getDb();
  const row = await sql`select category_id from items where id = ${id}`;
  if (row.length === 0) throw new UserError("Item não encontrado.");
  const list = await sql`select id from items where category_id = ${row[0].category_id} order by sort_order, id`;
  const ids = swapped(list.map((r) => r.id as number), id, dir);
  if (!ids) throw new UserError("Item não encontrado.");
  await sql`update items set sort_order = u.ord, updated_at = now()
            from unnest(${ids}::int[], ${ids.map((_, i) => i)}::int[]) as u(id, ord)
            where items.id = u.id`;
}

/** Apaga o item (e as opções). Devolve a URL da foto para apagar do Blob (null se outro item ainda a usa). */
export async function deleteItem(id: number): Promise<string | null> {
  const rows = await getDb()`delete from items where id = ${id} returning image_url`;
  if (rows.length === 0) throw new UserError("Item não encontrado. Ele pode já ter sido apagado.");
  const url = (rows[0].image_url as string | null) ?? null;
  return url && !(await imageUsedByOtherItem(url, id)) ? url : null;
}

// ----------------------------------------------------------- categorias

export async function saveCategory(input: CategoryInput): Promise<void> {
  const sql = getDb();
  const note = input.note || null;
  const emoji = input.emoji || "🍰";
  if (input.id === undefined) {
    const base = slugify(input.name);
    const slug = uniqueSlug(base, await takenSlugs("categories", base));
    await sql`insert into categories (slug, name, note, emoji, sort_order)
              values (${slug}, ${input.name}, ${note}, ${emoji},
                      coalesce((select max(sort_order) + 1 from categories), 0))`;
    return;
  }
  const rows = await sql`update categories set name = ${input.name}, note = ${note}, emoji = ${emoji}, updated_at = now()
                         where id = ${input.id} returning id`;
  if (rows.length === 0) throw new UserError("Categoria não encontrada.");
}

export async function moveCategory(id: number, dir: Direction): Promise<void> {
  const sql = getDb();
  const list = await sql`select id from categories order by sort_order, id`;
  const ids = swapped(list.map((r) => r.id as number), id, dir);
  if (!ids) throw new UserError("Categoria não encontrada.");
  await sql`update categories set sort_order = u.ord, updated_at = now()
            from unnest(${ids}::int[], ${ids.map((_, i) => i)}::int[]) as u(id, ord)
            where categories.id = u.id`;
}

/** Só apaga categoria vazia (a dona move ou apaga os itens antes). */
export async function deleteCategory(id: number): Promise<void> {
  const sql = getDb();
  const count = await sql`select count(*)::int as n from items where category_id = ${id}`;
  if ((count[0].n as number) > 0) {
    throw new UserError("Esta categoria ainda tem itens. Mova ou apague os itens antes de excluir.");
  }
  const rows = await sql`delete from categories where id = ${id} returning id`;
  if (rows.length === 0) throw new UserError("Categoria não encontrada.");
}

// ------------------------------------------------------------ configurações

export async function saveSettings(input: SettingsInput): Promise<void> {
  await getDb()`
    update settings set
      whatsapp_number = ${input.whatsappNumber},
      order_deadline = ${input.orderDeadline || null}::date,
      last_delivery_date = ${input.lastDeliveryDate || null}::date,
      min_lead_days = ${input.minLeadDays},
      notice_lines = ${input.noticeLines.join("\n")},
      deposit_percent = ${input.depositPercent},
      pix_key = ${input.pixKey},
      pix_key_type = ${input.pixKeyType},
      pix_holder = ${input.pixHolder},
      payment_note = ${input.paymentNote},
      updated_at = now()
    where id = 1`;
}
