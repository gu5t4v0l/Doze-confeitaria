"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { buildCatalogIndex, sanitizeCart, type Cart, type CatalogIndex } from "@/lib/cart";
import { pruneCart, useRawCart } from "@/lib/cart-store";
import type { Catalog } from "@/lib/catalog-types";

interface CatalogContextValue {
  catalog: Catalog;
  index: CatalogIndex;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/**
 * Entrega o cardápio vindo do servidor aos componentes do carrinho e descarta,
 * ao hidratar, itens do localStorage que não existem mais ou foram escondidos.
 */
export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  const value = useMemo(
    () => ({ catalog, index: buildCatalogIndex(catalog.categories) }),
    [catalog],
  );
  useEffect(() => {
    pruneCart(value.index);
  }, [value.index]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog precisa estar dentro de <CatalogProvider>");
  return ctx;
}

/** Carrinho já validado contra o catálogo atual (preço nunca vem do storage). */
export function useCart(): Cart {
  const raw = useRawCart();
  const { index } = useCatalog();
  return useMemo(() => sanitizeCart(raw, index), [raw, index]);
}
