"use client";

import { useId, useState } from "react";
import { getLines, cartSummary } from "@/lib/cart";
import { useToday } from "@/lib/use-today";
import { clearCart, setLineQty } from "@/lib/cart-store";
import { useCart, useCatalog } from "@/components/catalog-provider";
import { OrdersClosedNotice, useOrdersClosed } from "@/components/orders-closed-notice";
import { getDateBounds, validateDesiredDate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { computePayment } from "@/lib/payment";
import { PaymentInfo } from "@/components/payment-info";
import {
  buildWhatsAppUrl,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  type Fulfillment,
} from "@/lib/whatsapp";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { NoticeBanner } from "@/components/notice-banner";
import { QuantityStepper } from "@/components/quantity-stepper";
import { cn } from "@/lib/utils";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FULFILLMENT_OPTIONS: { value: Fulfillment; label: string; icon: string }[] = [
  { value: "entrega", label: "Entrega", icon: "ri-e-bike-2-line" },
  { value: "retirada", label: "Retirada", icon: "ri-store-2-line" },
];

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const cart = useCart();
  const { catalog, index } = useCatalog();
  const { settings } = catalog;
  const uid = useId();
  const today = useToday();
  const closed = useOrdersClosed();
  const [name, setName] = useState("");
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const lines = getLines(cart, index);
  const { count, totalCents } = cartSummary(cart, index);
  const empty = lines.length === 0;
  const split = computePayment(totalCents, settings.depositPercent);

  const bounds = today ? getDateBounds(today, settings) : null;
  const dateError = today ? validateDesiredDate(date, today, settings) : null;
  const canSend = !empty && !dateError && !closed;
  const whatsappUrl = canSend
    ? buildWhatsAppUrl(settings.whatsappNumber, {
        cart,
        index,
        name,
        fulfillment,
        date,
        notes,
        depositPercent: settings.depositPercent,
      })
    : "";

  const ids = {
    name: `${uid}-nome`,
    date: `${uid}-data`,
    dateError: `${uid}-data-erro`,
    notes: `${uid}-obs`,
  };

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmClear(false);
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] gap-0 rounded-t-3xl border-t-2 border-choc bg-cream p-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="relative border-b border-choc/15 p-4 pr-16">
          <SheetTitle className="font-display text-2xl font-black text-choc">
            Seu pedido
          </SheetTitle>
          <SheetDescription className="text-choc-muted">
            Confira os itens e envie pelo WhatsApp.
          </SheetDescription>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2.5 right-2.5 text-choc"
              />
            }
          >
            <i className="ri-close-line text-2xl" aria-hidden="true" />
            <span className="sr-only">Fechar pedido</span>
          </SheetClose>
        </SheetHeader>

        {empty ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="text-5xl" aria-hidden="true">
              🧁
            </span>
            <p className="font-display text-xl font-bold text-choc-deep">
              Seu pedido está vazio
            </p>
            <p className="text-sm text-choc-muted">
              Adicione itens do cardápio para montar sua encomenda.
            </p>
            <SheetClose render={<Button variant="outline" className="mt-2" />}>
              Ver cardápio
            </SheetClose>
            <Button size="lg" className="w-full" disabled>
              <i className="ri-whatsapp-line text-xl" aria-hidden="true" />
              Enviar pedido pelo WhatsApp
            </Button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <ul className="divide-y divide-choc/15">
                {lines.map((line) => {
                  const label = line.optionLabel
                    ? `${line.item.name} (${line.optionLabel})`
                    : line.item.name;
                  return (
                    <li key={line.key} className="flex flex-col gap-2 py-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-choc-deep">
                            {line.item.name}
                          </p>
                          {line.optionLabel && (
                            <p className="text-sm text-choc-muted">{line.optionLabel}</p>
                          )}
                          <p className="text-sm text-choc-muted">
                            {formatBRL(line.unitPriceCents)} cada
                          </p>
                        </div>
                        <p className="shrink-0 font-display text-lg font-black text-choc">
                          {formatBRL(line.totalCents)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <QuantityStepper
                          qty={line.qty}
                          label={label}
                          onChange={(q) => setLineQty(line.key, q)}
                        />
                        <button
                          type="button"
                          onClick={() => setLineQty(line.key, 0)}
                          aria-label={`Remover ${label} do pedido`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <i className="ri-delete-bin-6-line text-base" aria-hidden="true" />
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex justify-end">
                {confirmClear ? (
                  <div className="flex items-center gap-1" role="group" aria-label="Confirmar limpeza do pedido">
                    <span className="text-sm font-medium text-choc-deep">Limpar tudo?</span>
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmClear(false)}
                      className="text-choc-deep"
                    >
                      Não
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        clearCart();
                        setConfirmClear(false);
                      }}
                    >
                      Sim, limpar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmClear(true)}
                    className="text-choc-deep"
                  >
                    <i className="ri-delete-bin-line" aria-hidden="true" />
                    Limpar pedido
                  </Button>
                )}
              </div>

              <OrdersClosedNotice />
              <NoticeBanner lines={settings.noticeLines} variant="compact" />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={ids.name} className="text-sm font-semibold text-choc-deep">
                    Seu nome <span className="font-normal text-choc-muted">(opcional)</span>
                  </Label>
                  <Input
                    id={ids.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="name"
                    placeholder="Como podemos te chamar?"
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-semibold text-choc-deep">
                    Entrega ou retirada{" "}
                    <span className="font-normal text-choc-muted">(opcional)</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {FULFILLMENT_OPTIONS.map((opt) => {
                      const selected = fulfillment === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-choc",
                            selected
                              ? "border-choc bg-choc text-cream"
                              : "border-input bg-cream text-choc-deep hover:bg-sage-light/60",
                          )}
                        >
                          <input
                            type="radio"
                            name={`${uid}-modo`}
                            value={opt.value}
                            checked={selected}
                            onChange={() => setFulfillment(opt.value)}
                            className="sr-only"
                          />
                          <i className={cn(opt.icon, "text-lg")} aria-hidden="true" />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <Label htmlFor={ids.date} className="text-sm font-semibold text-choc-deep">
                    Data desejada{" "}
                    <span className="font-normal text-choc-muted">(opcional)</span>
                  </Label>
                  <Input
                    id={ids.date}
                    type="date"
                    value={date}
                    min={bounds && (!bounds.max || bounds.min <= bounds.max) ? bounds.min : undefined}
                    max={bounds?.max ?? undefined}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={dateError ? ids.dateError : undefined}
                  />
                  {dateError && (
                    <p id={ids.dateError} role="alert" className="text-sm font-medium text-destructive">
                      {dateError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={ids.notes} className="text-sm font-semibold text-choc-deep">
                    Observações{" "}
                    <span className="font-normal text-choc-muted">(opcional)</span>
                  </Label>
                  <Textarea
                    id={ids.notes}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={MAX_NOTES_LENGTH}
                    rows={3}
                    placeholder="Alergias, recado no bolo, horário preferido..."
                  />
                </div>
              </div>

              <PaymentInfo settings={settings} split={split} />
            </div>

            <div className="space-y-3 border-t-2 border-choc/20 bg-cream p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <dl className="space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm font-semibold text-choc-deep">
                    Total ({count} {count === 1 ? "item" : "itens"})
                  </dt>
                  <dd className="font-display text-2xl font-black text-choc">
                    {formatBRL(totalCents)}
                  </dd>
                </div>
                {split.percent > 0 && (
                  <>
                    <div className="flex items-baseline justify-between text-sm text-choc-deep">
                      <dt className="font-semibold">Sinal ({split.percent}%) — Pix agora</dt>
                      <dd className="font-bold">{formatBRL(split.depositCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between text-sm text-choc-deep">
                      <dt>Restante na entrega/retirada</dt>
                      <dd className="font-bold">{formatBRL(split.remainingCents)}</dd>
                    </div>
                  </>
                )}
              </dl>
              {canSend ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  <i className="ri-whatsapp-line text-xl" aria-hidden="true" />
                  Enviar pedido pelo WhatsApp
                </a>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  <i className="ri-whatsapp-line text-xl" aria-hidden="true" />
                  Enviar pedido pelo WhatsApp
                </Button>
              )}
              <p className="text-center text-xs text-choc-muted">
                {split.percent > 0
                  ? "Não há pagamento no site: o sinal é por Pix, combinado pelo WhatsApp."
                  : "O pagamento é combinado direto pelo WhatsApp."}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
