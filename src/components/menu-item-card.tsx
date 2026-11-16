"use client";

import type { CatalogCategory, CatalogItem } from "@/lib/catalog-types";
import { optionsFor } from "@/lib/cart";
import { setLineQty } from "@/lib/cart-store";
import { formatBRLCompact } from "@/lib/format";
import { useCart, useCatalog } from "@/components/catalog-provider";
import { ProductArt } from "@/components/product-art";
import { QuantityStepper } from "@/components/quantity-stepper";

interface MenuItemCardProps {
  item: CatalogItem;
  category: Pick<CatalogCategory, "emoji" | "tone">;
}

export function MenuItemCard({ item, category }: MenuItemCardProps) {
  const cart = useCart();
  const { index } = useCatalog();
  const options = optionsFor(item, index);
  const hasVariants = item.options.length > 0;

  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-choc/20 bg-cream p-3.5 shadow-[0_2px_0_rgb(122_46_18/0.12)]">
      <div className="flex gap-3">
        <ProductArt
          imageUrl={item.imageUrl}
          emoji={item.emoji ?? category.emoji}
          tone={category.tone}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-snug font-bold text-choc-deep">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 text-sm leading-snug text-choc-muted">{item.description}</p>
          )}
          {item.glutenFree && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sage-light px-2.5 py-1 text-xs font-semibold text-choc-deep">
              <i className="ri-leaf-line" aria-hidden="true" />
              Sem glúten
            </span>
          )}
        </div>
      </div>

      {hasVariants ? (
        <ul className="divide-y divide-choc/15 rounded-2xl bg-sage-light/50 px-3">
          {options.map((opt) => (
            <li
              key={opt.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-choc-deep">{opt.optionLabel}</p>
                <p className="font-display text-lg font-black text-choc">
                  {formatBRLCompact(opt.unitPriceCents)}
                </p>
              </div>
              <QuantityStepper
                qty={cart[opt.key] ?? 0}
                label={`${item.name} (${opt.optionLabel})`}
                onChange={(q) => setLineQty(opt.key, q)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-2xl font-black text-choc">
            {formatBRLCompact(item.priceCents)}
          </p>
          <QuantityStepper
            qty={cart[item.id] ?? 0}
            label={item.name}
            onChange={(q) => setLineQty(item.id, q)}
          />
        </div>
      )}
    </li>
  );
}
