"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  deleteCategoryAction,
  deleteItemAction,
  moveCategoryAction,
  moveItemAction,
  saveCategoryAction,
  setItemActiveAction,
} from "@/app/admin/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { AdminCategory, AdminItem } from "@/lib/catalog-types";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const iconBtn =
  "grid size-11 shrink-0 place-items-center rounded-full border border-choc/30 bg-cream text-choc transition-colors hover:bg-sage-light disabled:opacity-40 disabled:hover:bg-cream";

export function AdminPanel({ categories }: { categories: AdminCategory[] }) {
  const { run, isPending, busyKey } = useAdminAction();
  const [categoryDialog, setCategoryDialog] = useState<{ mode: "new" } | { mode: "edit"; category: AdminCategory } | null>(null);
  const [deleteItem, setDeleteItem] = useState<AdminItem | null>(null);
  const [deleteCat, setDeleteCat] = useState<AdminCategory | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black text-choc">Seu cardápio</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/item/novo" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>
            <i className="ri-add-line text-xl" aria-hidden="true" />
            Novo item
          </Link>
          <Button size="lg" variant="outline" className="rounded-full" onClick={() => setCategoryDialog({ mode: "new" })}>
            <i className="ri-folder-add-line text-xl" aria-hidden="true" />
            Nova categoria
          </Button>
        </div>
      </div>

      {categories.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-choc/50 bg-cream p-6 text-center font-medium text-choc-deep">
          Ainda não há categorias. Crie uma categoria para começar a cadastrar itens.
        </p>
      )}

      {categories.map((cat, ci) => (
        <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="space-y-3 rounded-3xl border border-choc/25 bg-cream/70 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id={`cat-${cat.id}`} className="font-display text-2xl leading-tight font-black text-choc">
                <span aria-hidden="true">{cat.emoji} </span>
                {cat.name}
              </h2>
              <p className="text-sm text-choc-muted">
                {cat.items.length === 0 ? "Nenhum item" : `${cat.items.length} ${cat.items.length === 1 ? "item" : "itens"}`}
                {cat.note ? ` · ${cat.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className={iconBtn}
                disabled={isPending || ci === 0}
                aria-label={`Subir a categoria ${cat.name}`}
                onClick={() => run(`mc-${cat.id}`, () => moveCategoryAction(cat.id, "up"))}
              >
                <i className="ri-arrow-up-line text-xl" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={isPending || ci === categories.length - 1}
                aria-label={`Descer a categoria ${cat.name}`}
                onClick={() => run(`mc-${cat.id}`, () => moveCategoryAction(cat.id, "down"))}
              >
                <i className="ri-arrow-down-line text-xl" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setCategoryDialog({ mode: "edit", category: cat })}>
              <i className="ri-edit-line text-lg" aria-hidden="true" />
              Renomear categoria
            </Button>
            <Button variant="ghost" className="rounded-full text-destructive" onClick={() => setDeleteCat(cat)}>
              <i className="ri-delete-bin-6-line text-lg" aria-hidden="true" />
              Excluir categoria
            </Button>
          </div>

          {cat.items.length === 0 ? (
            <p className="rounded-2xl bg-sage-light/50 p-4 text-center text-choc-deep">Esta categoria está vazia.</p>
          ) : (
            <ul className="space-y-2.5">
              {cat.items.map((item, ii) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  emoji={item.emoji ?? cat.emoji}
                  first={ii === 0}
                  last={ii === cat.items.length - 1}
                  busy={isPending && busyKey?.endsWith(`-${item.id}`) === true}
                  disabled={isPending}
                  onToggle={(active) => run(`active-${item.id}`, () => setItemActiveAction(item.id, active))}
                  onMove={(dir) => run(`mi-${item.id}`, () => moveItemAction(item.id, dir))}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}

      <CategorySheet
        state={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        pending={isPending}
        onSave={(input) =>
          run("save-cat", () => saveCategoryAction(input), () => setCategoryDialog(null))
        }
      />

      <ConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title={`Apagar “${deleteItem?.name ?? ""}”?`}
        description={
          <>
            Isso não pode ser desfeito. <strong>Prefere só esconder?</strong> Escondido, o item some do cardápio mas você
            pode voltar a mostrá-lo quando quiser.
          </>
        }
        confirmLabel="Apagar de vez"
        destructive
        pending={isPending}
        extraAction={{
          label: "Só esconder do cardápio",
          onClick: () => {
            const target = deleteItem;
            setDeleteItem(null);
            if (target) run(`active-${target.id}`, () => setItemActiveAction(target.id, false));
          },
        }}
        onConfirm={() => {
          const target = deleteItem;
          setDeleteItem(null);
          if (target) run(`del-${target.id}`, () => deleteItemAction(target.id));
        }}
      />

      <ConfirmDialog
        open={deleteCat !== null}
        onOpenChange={(o) => !o && setDeleteCat(null)}
        title={`Excluir a categoria “${deleteCat?.name ?? ""}”?`}
        description={
          deleteCat && deleteCat.items.length > 0
            ? "Esta categoria ainda tem itens. Mova ou apague os itens antes de excluir a categoria."
            : "Isso não pode ser desfeito."
        }
        confirmLabel={deleteCat && deleteCat.items.length > 0 ? "Entendi" : "Excluir categoria"}
        destructive={!deleteCat || deleteCat.items.length === 0}
        pending={isPending}
        onConfirm={() => {
          const target = deleteCat;
          setDeleteCat(null);
          if (target && target.items.length === 0) run(`dc-${target.id}`, () => deleteCategoryAction(target.id));
        }}
      />
    </div>
  );
}

interface ItemRowProps {
  item: AdminItem;
  emoji: string;
  first: boolean;
  last: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: (active: boolean) => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
}

function ItemRow({ item, emoji, first, last, busy, disabled, onToggle, onMove, onDelete }: ItemRowProps) {
  const price =
    item.options.length > 0 ? `a partir de ${formatBRL(Math.min(...item.options.map((o) => o.priceCents)))}` : formatBRL(item.priceCents);
  return (
    <li
      aria-busy={busy}
      className={cn(
        "space-y-3 rounded-2xl border border-choc/20 bg-cream p-3 transition-opacity",
        !item.active && "bg-sage-light/60",
        busy && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-choc/25 bg-[radial-gradient(circle_at_30%_25%,#f4f7ea,#cfd9b8_75%)]",
            !item.active && "grayscale",
          )}
        >
          {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : <span className="text-3xl">{emoji}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-snug font-bold text-choc-deep">{item.name}</p>
          <p className="font-display text-lg font-black text-choc">{price}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" className={cn(iconBtn, "size-10")} disabled={disabled || first} aria-label={`Subir ${item.name}`} onClick={() => onMove("up")}>
            <i className="ri-arrow-up-line text-lg" aria-hidden="true" />
          </button>
          <button type="button" className={cn(iconBtn, "size-10")} disabled={disabled || last} aria-label={`Descer ${item.name}`} onClick={() => onMove("down")}>
            <i className="ri-arrow-down-line text-lg" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={item.active}
            disabled={disabled}
            onCheckedChange={onToggle}
            aria-label={`${item.name}: ${item.active ? "disponível" : "escondido"}. Alternar`}
          />
          <span className={cn("text-sm font-bold", item.active ? "text-choc-deep" : "text-destructive")}>
            {item.active ? "Disponível" : "Escondido"}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/item/${item.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            aria-label={`Editar ${item.name}`}
          >
            <i className="ri-edit-line text-lg" aria-hidden="true" />
            Editar
          </Link>
          <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={onDelete} disabled={disabled} aria-label={`Apagar ${item.name}`}>
            <i className="ri-delete-bin-6-line text-xl" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

interface CategorySheetProps {
  state: { mode: "new" } | { mode: "edit"; category: AdminCategory } | null;
  onClose: () => void;
  pending: boolean;
  onSave: (input: { id?: number; name: string; note: string; emoji: string }) => void;
}

function CategorySheet({ state, onClose, pending, onSave }: CategorySheetProps) {
  return (
    <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] gap-0 rounded-t-3xl border-t-2 border-choc bg-cream p-0 sm:mx-auto sm:max-w-lg">
        {state && <CategoryForm key={state.mode === "edit" ? state.category.id : "new"} state={state} pending={pending} onSave={onSave} />}
      </SheetContent>
    </Sheet>
  );
}

function CategoryForm({ state, pending, onSave }: { state: NonNullable<CategorySheetProps["state"]>; pending: boolean; onSave: CategorySheetProps["onSave"] }) {
  const cat = state.mode === "edit" ? state.category : null;
  const [name, setName] = useState(cat?.name ?? "");
  const [note, setNote] = useState(cat?.note ?? "");
  const [emoji, setEmoji] = useState(cat?.emoji ?? "🍰");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Escreva o nome da categoria.");
          return;
        }
        onSave({ id: cat?.id, name, note, emoji });
      }}
    >
      <SheetHeader className="relative border-b border-choc/15 p-4 pr-16">
        <SheetTitle className="font-display text-2xl font-black text-choc">{cat ? "Renomear categoria" : "Nova categoria"}</SheetTitle>
        <SheetDescription className="text-choc-muted">Categorias agrupam os itens no cardápio.</SheetDescription>
        <SheetClose render={<Button variant="ghost" size="icon" className="absolute top-2.5 right-2.5 text-choc" />}>
          <i className="ri-close-line text-2xl" aria-hidden="true" />
          <span className="sr-only">Fechar</span>
        </SheetClose>
      </SheetHeader>
      <div className="space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <label htmlFor="cat-nome" className="text-sm font-semibold text-choc-deep">
            Nome
          </label>
          <Input id="cat-nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-12" aria-invalid={error ? true : undefined} aria-describedby={error ? "cat-erro" : undefined} />
          {error && (
            <p id="cat-erro" role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cat-nota" className="text-sm font-semibold text-choc-deep">
            Observação <span className="font-normal text-choc-muted">(opcional, aparece ao lado do título)</span>
          </label>
          <Input id="cat-nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Ex.: Temos opções sem glúten." className="h-12" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cat-emoji" className="text-sm font-semibold text-choc-deep">
            Emoji <span className="font-normal text-choc-muted">(opcional)</span>
          </label>
          <Input id="cat-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="h-12 w-24 text-center text-2xl" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Salvando..." : "Salvar categoria"}
        </Button>
      </div>
    </form>
  );
}
