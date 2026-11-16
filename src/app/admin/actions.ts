"use server";

import { updateTag } from "next/cache";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth/session";
import * as db from "@/lib/admin/mutations";
import { UserError } from "@/lib/admin/mutations";
import {
  categorySchema,
  directionSchema,
  firstIssue,
  idSchema,
  itemSchema,
  settingsSchema,
} from "@/lib/admin/schemas";
import { isAllowedBlobUrl } from "@/lib/blob-url";
import { MENU_TAG } from "@/lib/menu-queries";

export type ActionResult<T = void> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";
const BAD_REQUEST: ActionResult<never> = { ok: false, error: "Pedido inválido. Recarregue a página." };

/** Apagar o arquivo antigo é "melhor esforço": falha não atrapalha a dona. */
async function deleteBlobQuietly(url: string | null) {
  if (!url || !isAllowedBlobUrl(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("[blob] não foi possível apagar a foto antiga:", e instanceof Error ? e.message : e);
  }
}

/**
 * Executa a mutação, invalida o cache da vitrine (tag "menu") e devolve uma mensagem
 * em pt-BR sem detalhes internos. A sessão é verificada ANTES, no topo de cada action.
 */
async function run<T = undefined>(message: string, work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await work();
    updateTag(MENU_TAG);
    return { ok: true, message, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error("[admin] erro na ação:", e instanceof Error ? e.message : "desconhecido");
    return { ok: false, error: GENERIC };
  }
}

export async function saveItemAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  await requireAdmin();
  const p = itemSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  return run("Item salvo.", async () => {
    const { id, staleImageUrl } = await db.saveItem(p.data);
    await deleteBlobQuietly(staleImageUrl);
    return { id };
  });
}

export async function setItemActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  await requireAdmin();
  const i = idSchema.safeParse(id);
  if (!i.success || typeof active !== "boolean") return BAD_REQUEST;
  return run(active ? "Item disponível no cardápio." : "Item escondido do cardápio.", () =>
    db.setItemActive(i.data, active),
  );
}

export async function moveItemAction(id: unknown, dir: unknown): Promise<ActionResult> {
  await requireAdmin();
  const i = idSchema.safeParse(id);
  const d = directionSchema.safeParse(dir);
  if (!i.success || !d.success) return BAD_REQUEST;
  return run("Ordem atualizada.", () => db.moveItem(i.data, d.data));
}

export async function deleteItemAction(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const i = idSchema.safeParse(id);
  if (!i.success) return BAD_REQUEST;
  return run("Item apagado.", async () => {
    const imageUrl = await db.deleteItem(i.data);
    await deleteBlobQuietly(imageUrl);
  });
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = categorySchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  return run("Categoria salva.", () => db.saveCategory(p.data));
}

export async function moveCategoryAction(id: unknown, dir: unknown): Promise<ActionResult> {
  await requireAdmin();
  const i = idSchema.safeParse(id);
  const d = directionSchema.safeParse(dir);
  if (!i.success || !d.success) return BAD_REQUEST;
  return run("Ordem atualizada.", () => db.moveCategory(i.data, d.data));
}

export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const i = idSchema.safeParse(id);
  if (!i.success) return BAD_REQUEST;
  return run("Categoria apagada.", () => db.deleteCategory(i.data));
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = settingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  return run("Configurações salvas.", () => db.saveSettings(p.data));
}
