"use client";

import { useCatalog } from "@/components/catalog-provider";
import { isOrdersClosed } from "@/lib/dates";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

/** Os pedidos já encerraram? (data limite do banco; "hoje" em America/Sao_Paulo) */
export function useOrdersClosed(): boolean {
  const { catalog } = useCatalog();
  const today = useToday();
  return today !== "" && isOrdersClosed(today, catalog.settings);
}

export function OrdersClosedNotice({ className }: { className?: string }) {
  const closed = useOrdersClosed();
  if (!closed) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border-2 border-destructive bg-cream p-4 text-choc-deep",
        className,
      )}
    >
      <i className="ri-time-line shrink-0 text-2xl text-destructive" aria-hidden="true" />
      <div>
        <p className="font-bold text-destructive">Pedidos encerrados para esta data</p>
        <p className="text-sm">
          Você ainda pode ver o cardápio. Fale com a gente pelo Instagram ou WhatsApp.
        </p>
      </div>
    </div>
  );
}
