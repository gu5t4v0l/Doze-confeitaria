// Uso: npm run db:seed  (idempotente: só cria o que ainda não existe)
import { neon } from "@neondatabase/serverless";
import { defaultSettings, seedCategories } from "../src/data/menu";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente. Rode via `npm run db:seed`.");
  process.exit(1);
}
const sql = neon(url);

async function main() {

  await sql`
    insert into settings (id, whatsapp_number, instagram_handle, order_deadline, last_delivery_date, min_lead_days, notice_lines,
                          deposit_percent, pix_key, pix_key_type, pix_holder, payment_note)
    values (1, ${defaultSettings.whatsappNumber}, ${defaultSettings.instagramHandle},
            ${defaultSettings.orderDeadline}, ${defaultSettings.lastDeliveryDate},
            ${defaultSettings.minLeadDays}, ${defaultSettings.noticeLines.join("\n")},
            ${defaultSettings.depositPercent}, ${defaultSettings.pixKey}, ${defaultSettings.pixKeyType},
            ${defaultSettings.pixHolder}, ${defaultSettings.paymentNote})
    on conflict (id) do nothing`;

  let createdItems = 0;
  for (const [ci, category] of seedCategories.entries()) {
    const rows = await sql`
      insert into categories (slug, name, note, emoji, tone, sort_order)
      values (${category.id}, ${category.title}, ${category.note}, ${category.emoji}, ${category.tone}, ${ci})
      on conflict (slug) do update set slug = excluded.slug
      returning id`;
    const categoryId = rows[0].id as number;
    for (const [ii, item] of category.items.entries()) {
      const inserted = await sql`
        insert into items (slug, category_id, name, description, price_cents, image_url, emoji, gluten_free, active, sort_order)
        values (${item.id}, ${categoryId}, ${item.name}, ${item.description}, ${item.priceCents},
                ${item.imageUrl}, ${item.emoji}, ${item.glutenFree}, true, ${ii})
        on conflict (slug) do nothing
        returning id`;
      if (inserted.length === 0) continue;
      createdItems++;
      const itemId = inserted[0].id as number;
      for (const [oi, option] of item.options.entries()) {
        await sql`
          insert into item_options (item_id, label, price_cents, sort_order)
          values (${itemId}, ${option.label}, ${option.priceCents}, ${oi})`;
      }
    }
  }
  console.log(`Seed concluído (${createdItems} itens novos).`);

}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
