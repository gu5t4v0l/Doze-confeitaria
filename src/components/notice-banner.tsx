import { paymentNoticeLine } from "@/lib/payment";
import { cn } from "@/lib/utils";

interface NoticeBannerProps {
  lines: string[];
  /** "full" = destaque no topo; "compact" = versão curta (carrinho/rodapé). */
  variant?: "full" | "compact";
  className?: string;
  /** Percentual do sinal: gera a linha fixa de pagamento (separada dos avisos editáveis). */
  depositPercent?: number;
}

export function NoticeBanner({ lines, variant = "full", className, depositPercent }: NoticeBannerProps) {
  const payment = depositPercent === undefined ? null : paymentNoticeLine(depositPercent);
  // não repete se a dona já escreveu algo sobre sinal/pagamento antecipado nos avisos
  const all =
    payment && !lines.some((l) => /antecipad|sinal/i.test(l)) ? [...lines, payment] : lines;
  if (all.length === 0) return null;
  const compact = variant === "compact";
  return (
    <aside
      aria-label="Avisos sobre encomendas"
      className={cn(
        "rounded-2xl border-2 border-dashed border-choc/60 bg-cream text-choc-deep",
        compact ? "p-3 text-sm" : "p-4 text-[0.95rem] shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <i
          className={cn(
            "ri-calendar-check-line shrink-0 text-choc",
            compact ? "text-xl" : "text-2xl",
          )}
          aria-hidden="true"
        />
        <ul className="space-y-1 leading-snug font-medium">
          {all.map((text, i) => (
            <li key={`${i}-${text}`}>{text}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
