"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { deleteItemAction, saveItemAction, setItemActiveAction } from "@/app/admin/actions";
import { MoneyInput } from "@/components/admin/money-input";
import { PhotoField } from "@/components/admin/photo-field";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminItem } from "@/lib/catalog-types";
import { MAX_PRICE_CENTS, centsToInput, parseMoneyToCents } from "@/lib/money";

interface OptionRow {
  key: number;
  id?: number;
  label: string;
  price: string;
}

interface ItemFormProps {
  item: AdminItem | null;
  categories: { id: number; name: string }[];
}

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-cream px-3 text-base text-choc-deep outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ItemForm({ item, categories }: ItemFormProps) {
  const router = useRouter();
  const uid = useId();
  const { run, isPending } = useAdminAction();
  const [nextKey, setNextKey] = useState(100);

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState<number>(item?.categoryId ?? categories[0]?.id ?? 0);
  const [price, setPrice] = useState(item && item.options.length === 0 ? centsToInput(item.priceCents) : "");
  const [glutenFree, setGlutenFree] = useState(item?.glutenFree ?? false);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState<OptionRow[]>(
    (item?.options ?? []).map((o, i) => ({ key: i, id: o.id, label: o.label, price: centsToInput(o.priceCents) })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasOptions = options.length > 0;

  function addOption() {
    setOptions((rows) => {
      if (rows.length === 0) {
        // o preço atual vira a primeira opção
        return [
          { key: nextKey, label: "Tradicional", price: price || "" },
          { key: nextKey + 1, label: "", price: "" },
        ];
      }
      return [...rows, { key: nextKey, label: "", price: "" }];
    });
    setNextKey((k) => k + 2);
  }

  function removeOption(key: number) {
    setOptions((rows) => {
      const next = rows.filter((r) => r.key !== key);
      return next.length === 1 ? [] : next; // sobrou uma só: volta ao preço simples
    });
    if (options.length === 2) {
      const left = options.find((r) => r.key !== key);
      if (left) setPrice(left.price);
    }
  }

  function updateOption(key: number, patch: Partial<OptionRow>) {
    setOptions((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Escreva o nome do item.";
    if (!hasOptions) {
      const cents = parseMoneyToCents(price);
      if (cents === null) e.price = "Informe o preço, por exemplo 49,90.";
      else if (cents > MAX_PRICE_CENTS) e.price = "Preço alto demais (máximo R$ 10.000,00).";
    } else {
      options.forEach((o) => {
        if (!o.label.trim()) e[`opt-label-${o.key}`] = "Escreva o nome da opção.";
        const cents = parseMoneyToCents(o.price);
        if (cents === null) e[`opt-price-${o.key}`] = "Informe o preço.";
        else if (cents > MAX_PRICE_CENTS) e[`opt-price-${o.key}`] = "Preço alto demais.";
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (uploading) return;
    if (!validate()) return;
    const payload = {
      id: item?.id,
      categoryId,
      name,
      description,
      priceCents: hasOptions ? 0 : (parseMoneyToCents(price) ?? 0),
      glutenFree,
      imageUrl,
      options: options.map((o) => ({ id: o.id, label: o.label, priceCents: parseMoneyToCents(o.price) ?? 0 })),
    };
    run("save", () => saveItemAction(payload), () => router.push("/admin"));
  }

  const busy = isPending || uploading;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          aria-label="Voltar ao cardápio"
          className="grid size-11 place-items-center rounded-full border border-choc/40 bg-cream/70 text-choc hover:bg-cream"
        >
          <i className="ri-arrow-left-line text-xl" aria-hidden="true" />
        </Link>
        <h1 className="font-display text-3xl font-black text-choc">{item ? "Editar item" : "Novo item"}</h1>
      </div>

      <div className="space-y-5 rounded-3xl border border-choc/25 bg-cream p-4 sm:p-5">
        <PhotoField
          value={imageUrl}
          onChange={setImageUrl}
          baseName={name || "item"}
          emoji={item?.emoji ?? "🍰"}
          onBusyChange={setUploading}
        />

        <div className="space-y-1.5">
          <label htmlFor={`${uid}-nome`} className="text-sm font-semibold text-choc-deep">
            Nome do item
          </label>
          <Input
            id={`${uid}-nome`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Ex.: Bolo de cenoura 1kg"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${uid}-nome-erro` : undefined}
            className="h-12"
          />
          {errors.name && (
            <p id={`${uid}-nome-erro`} role="alert" className="text-sm font-semibold text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${uid}-desc`} className="text-sm font-semibold text-choc-deep">
            Descrição <span className="font-normal text-choc-muted">(opcional)</span>
          </label>
          <Textarea
            id={`${uid}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Ex.: Massa fofinha com cobertura de brigadeiro."
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${uid}-cat`} className="text-sm font-semibold text-choc-deep">
            Categoria
          </label>
          <select id={`${uid}-cat`} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={selectClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!hasOptions && (
          <div>
            <MoneyInput
              label="Preço"
              value={price}
              onChange={setPrice}
              invalid={!!errors.price}
              describedBy={errors.price ? `${uid}-preco-erro` : undefined}
            />
            {errors.price && (
              <p id={`${uid}-preco-erro`} role="alert" className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.price}
              </p>
            )}
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-choc-deep">
            Opções <span className="font-normal text-choc-muted">(tamanhos ou recheios, cada um com seu preço)</span>
          </legend>
          {hasOptions && (
            <ul className="space-y-3">
              {options.map((o, i) => (
                <li key={o.key} className="space-y-2 rounded-2xl border border-choc/25 bg-sage-light/40 p-3">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <label htmlFor={`${uid}-ol-${o.key}`} className="text-sm font-semibold text-choc-deep">
                        Opção {i + 1}
                      </label>
                      <Input
                        id={`${uid}-ol-${o.key}`}
                        value={o.label}
                        onChange={(e) => updateOption(o.key, { label: e.target.value })}
                        maxLength={80}
                        placeholder="Ex.: Com recheio de doce de leite"
                        aria-invalid={errors[`opt-label-${o.key}`] ? true : undefined}
                        className="h-12"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(o.key)}
                      aria-label={`Remover opção ${i + 1}`}
                      className="mb-0.5 text-destructive"
                    >
                      <i className="ri-delete-bin-6-line text-xl" aria-hidden="true" />
                    </Button>
                  </div>
                  <MoneyInput
                    label={`Preço da opção ${i + 1}`}
                    value={o.price}
                    onChange={(v) => updateOption(o.key, { price: v })}
                    invalid={!!errors[`opt-price-${o.key}`]}
                  />
                  {(errors[`opt-label-${o.key}`] || errors[`opt-price-${o.key}`]) && (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                      {errors[`opt-label-${o.key}`] ?? errors[`opt-price-${o.key}`]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" onClick={addOption} disabled={options.length >= 20}>
            <i className="ri-add-line text-lg" aria-hidden="true" />
            {hasOptions ? "Adicionar outra opção" : "Adicionar opções"}
          </Button>
          {hasOptions && (
            <p className="text-sm text-choc-muted">No cardápio aparece &ldquo;a partir do menor preço&rdquo; e o cliente escolhe a opção.</p>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-choc/25 p-3">
          <div>
            <p id={`${uid}-sg`} className="font-semibold text-choc-deep">
              Sem glúten
            </p>
            <p className="text-sm text-choc-muted">Marque só se o item realmente é sem glúten.</p>
          </div>
          <Switch checked={glutenFree} onCheckedChange={setGlutenFree} aria-labelledby={`${uid}-sg`} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" size="lg" disabled={busy} className="sm:flex-1">
          {isPending ? (
            <>
              <i className="ri-loader-4-line animate-spin text-xl" aria-hidden="true" />
              Salvando...
            </>
          ) : uploading ? (
            "Enviando foto..."
          ) : (
            <>
              <i className="ri-save-line text-xl" aria-hidden="true" />
              Salvar
            </>
          )}
        </Button>
        <Link
          href="/admin"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background px-5 text-base font-medium hover:bg-muted sm:flex-1"
        >
          Cancelar
        </Link>
      </div>

      {item && (
        <div className="space-y-2 border-t border-choc/25 pt-5">
          <Button type="button" variant="destructive" size="lg" className="w-full" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <i className="ri-delete-bin-6-line text-xl" aria-hidden="true" />
            Apagar este item
          </Button>
        </div>
      )}

      {item && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Apagar “${item.name}”?`}
          description={
            <>
              Isso não pode ser desfeito. <strong>Prefere só esconder?</strong> Escondido, o item some do cardápio mas
              você pode voltar a mostrá-lo quando quiser.
            </>
          }
          confirmLabel="Apagar de vez"
          destructive
          pending={isPending}
          extraAction={{
            label: "Só esconder do cardápio",
            onClick: () => {
              setConfirmDelete(false);
              run("hide", () => setItemActiveAction(item.id, false), () => router.push("/admin"));
            },
          }}
          onConfirm={() => {
            setConfirmDelete(false);
            run("delete", () => deleteItemAction(item.id), () => router.push("/admin"));
          }}
        />
      )}
    </form>
  );
}
