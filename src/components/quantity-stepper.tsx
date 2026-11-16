"use client";

import { MAX_QTY } from "@/lib/cart";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  qty: number;
  /** Nome do produto, usado nos rótulos de acessibilidade. */
  label: string;
  onChange: (qty: number) => void;
  className?: string;
}

const roundBtn =
  "grid size-11 shrink-0 place-items-center rounded-full text-choc transition-colors hover:bg-sage-light active:bg-sage disabled:opacity-40 disabled:hover:bg-transparent";

export function QuantityStepper({ qty, label, onChange, className }: QuantityStepperProps) {
  if (qty <= 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={`Adicionar ${label} ao pedido`}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-full bg-choc px-5 text-sm font-semibold text-cream transition-colors hover:bg-choc-deep active:scale-[0.98]",
          className,
        )}
      >
        <i className="ri-add-line text-lg" aria-hidden="true" />
        Adicionar
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Quantidade de ${label}`}
      className={cn(
        "inline-flex items-center rounded-full border-2 border-choc bg-cream",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label={`Diminuir quantidade de ${label}`}
        className={roundBtn}
      >
        <i
          className={cn("text-lg", qty === 1 ? "ri-delete-bin-6-line" : "ri-subtract-line")}
          aria-hidden="true"
        />
      </button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-8 text-center text-base font-bold text-choc-deep tabular-nums"
      >
        {qty}
        <span className="sr-only"> no pedido</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= MAX_QTY}
        aria-label={`Aumentar quantidade de ${label}`}
        className={roundBtn}
      >
        <i className="ri-add-line text-lg" aria-hidden="true" />
      </button>
    </div>
  );
}
