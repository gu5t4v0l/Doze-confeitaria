"use client";

import { useState } from "react";
import { cartSummary } from "@/lib/cart";
import { formatBRL, formatItemCount } from "@/lib/format";
import { useCart, useCatalog } from "@/components/catalog-provider";
import { CartSheet } from "@/components/cart-sheet";

/** Barra flutuante "Ver pedido" + bottom sheet do carrinho. */
export function CartBar() {
  const cart = useCart();
  const { index } = useCatalog();
  const [open, setOpen] = useState(false);
  const { count, totalCents } = cartSummary(cart, index);

  return (
    <>
      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-lg animate-bar-in items-center justify-between gap-3 rounded-2xl bg-choc px-5 text-cream shadow-[0_8px_24px_rgb(74_29_11/0.35)] ring-2 ring-cream/70 transition-colors hover:bg-choc-deep focus-visible:outline-cream"
          >
            <span className="flex items-center gap-2.5 text-[0.95rem] font-semibold">
              <i className="ri-shopping-basket-2-line text-xl" aria-hidden="true" />
              Ver pedido • {formatItemCount(count)}
            </span>
            <span className="font-display text-lg font-black">{formatBRL(totalCents)}</span>
          </button>
        </div>
      )}
      <CartSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
