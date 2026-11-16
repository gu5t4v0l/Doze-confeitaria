import type { CatalogCategory } from "@/lib/catalog-types";
import { MenuItemCard } from "@/components/menu-item-card";

export function MenuSection({ category }: { category: CatalogCategory }) {
  const headingId = `${category.id}-titulo`;
  return (
    <section
      id={category.id}
      aria-labelledby={headingId}
      className="scroll-mt-16 px-4 pt-8 sm:px-6"
    >
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <h2
          id={headingId}
          className="font-display text-4xl leading-none font-black tracking-tight text-choc sm:text-5xl"
        >
          {category.title}
        </h2>
        {category.note && (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-choc/40 bg-cream/70 px-3 py-1.5 text-sm font-semibold text-choc-deep">
            <i className="ri-leaf-line text-base" aria-hidden="true" />
            {category.note}
          </p>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {category.items.map((item) => (
          <MenuItemCard key={item.id} item={item} category={category} />
        ))}
      </ul>
    </section>
  );
}
