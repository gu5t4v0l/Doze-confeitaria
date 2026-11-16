"use client";

import { useSyncExternalStore } from "react";
import { clampQty, sanitizeCartShape, type Cart, type CatalogIndex } from "@/lib/cart";

const STORAGE_KEY = "doze-confeitaria:cart:v2";
const EMPTY: Cart = Object.freeze({}) as Cart;

let cart: Cart = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): Cart {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeCartShape(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  cart = readStorage();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // armazenamento indisponível: o carrinho segue só em memória
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  cart = readStorage();
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Cart {
  ensureLoaded();
  return cart;
}

function getServerSnapshot(): Cart {
  return EMPTY;
}

/** Altera uma linha (0 remove). O chamador só passa chaves do catálogo atual. */
export function setLineQty(key: string, qty: number) {
  ensureLoaded();
  const q = clampQty(qty);
  const next = { ...cart };
  if (q === 0) delete next[key];
  else next[key] = q;
  cart = next;
  persist();
  emit();
}

export function clearCart() {
  ensureLoaded();
  cart = EMPTY;
  persist();
  emit();
}

/** Descarta do armazenamento linhas que não existem mais (ou estão ocultas) no catálogo. */
export function pruneCart(index: CatalogIndex) {
  ensureLoaded();
  const keys = Object.keys(cart);
  if (keys.every((k) => index.has(k))) return;
  const next: Cart = {};
  for (const k of keys) if (index.has(k)) next[k] = cart[k];
  cart = next;
  persist();
  emit();
}

/** Carrinho bruto (só a forma foi validada). Prefira `useCart()` do CatalogProvider. */
export function useRawCart(): Cart {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
