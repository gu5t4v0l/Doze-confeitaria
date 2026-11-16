"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatPixKeyForDisplay,
  paymentSummaryText,
  PIX_KEY_TYPE_LABEL,
  type PaymentSplit,
} from "@/lib/payment";
import type { SiteSettings } from "@/lib/catalog-types";

/** Copia texto: Clipboard API e, se falhar (http, permissões), textarea + execCommand. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no plano B */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Bloco "Pagamento" do carrinho: explica o sinal, mostra a chave Pix (se houver) e a nota. */
export function PaymentInfo({ settings, split }: { settings: SiteSettings; split: PaymentSplit }) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const { pixKey, pixKeyType, pixHolder, paymentNote } = settings;
  const hasKey = pixKey !== "";
  const depositOn = split.percent > 0;
  if (!depositOn && !paymentNote) return null;

  async function copy() {
    const ok = await copyText(pixKey);
    setStatus(ok ? "Chave Pix copiada." : "Não foi possível copiar. Selecione a chave e copie manualmente.");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <section
      aria-labelledby="pagamento-titulo"
      className="space-y-2 rounded-2xl border-2 border-choc/40 bg-sage-light/40 p-3 text-sm text-choc-deep"
    >
      <h3 id="pagamento-titulo" className="flex items-center gap-2 font-display text-base font-black text-choc">
        <i className="ri-qr-code-line text-lg" aria-hidden="true" />
        Pagamento
      </h3>

      {depositOn && (
        <>
          <p className="leading-snug">{paymentSummaryText(split)}</p>
          {hasKey ? (
            <div className="space-y-2">
              <dl className="space-y-0.5 rounded-xl bg-cream p-2.5">
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-choc-muted">{pixKeyType ? PIX_KEY_TYPE_LABEL[pixKeyType] : "Chave Pix"}:</dt>
                  <dd className="font-semibold break-all select-all">
                    {formatPixKeyForDisplay(pixKeyType, pixKey)}
                  </dd>
                </div>
                {pixHolder && (
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="text-choc-muted">Favorecido:</dt>
                    <dd className="font-semibold">{pixHolder}</dd>
                  </div>
                )}
              </dl>
              <Button type="button" variant="outline" onClick={copy} className="w-full sm:w-auto">
                <i className="ri-file-copy-line text-lg" aria-hidden="true" />
                Copiar chave
              </Button>
              <p className="leading-snug font-semibold">
                Só faça o Pix depois que a DoZé confirmar seu pedido pelo WhatsApp.
              </p>
            </div>
          ) : (
            <p className="leading-snug font-semibold">A chave Pix será enviada na confirmação do pedido.</p>
          )}
        </>
      )}

      {paymentNote && <p className="leading-snug">{paymentNote}</p>}

      <p role="status" aria-live="polite" className="min-h-0 text-sm font-semibold text-choc">
        {status}
      </p>
    </section>
  );
}
