"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { centsToInput, parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  hideLabel?: boolean;
}

/**
 * Campo de preço: teclado numérico, vírgula decimal (pt-BR). Aceita "19", "19,5", "1.234,56".
 * Ao sair do campo, formata como "19,50".
 */
export function MoneyInput({ value, onChange, label, invalid, describedBy, className, hideLabel }: MoneyInputProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-semibold text-choc-deep", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-semibold text-choc-muted">
          R$
        </span>
        <Input
          id={id}
          value={value}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          maxLength={12}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 pl-11 text-lg font-semibold tabular-nums"
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          onBlur={() => {
            const cents = parseMoneyToCents(value);
            if (cents !== null) onChange(centsToInput(cents));
          }}
        />
      </div>
    </div>
  );
}
