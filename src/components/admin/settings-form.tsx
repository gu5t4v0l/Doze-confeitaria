"use client";

import { useId, useState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettings } from "@/lib/catalog-types";
import { formatPhoneBR } from "@/lib/format";
import {
  MAX_PAYMENT_NOTE_LENGTH,
  MAX_PIX_HOLDER_LENGTH,
  MAX_PIX_KEY_LENGTH,
  PIX_KEY_TYPE_LABEL,
  PIX_KEY_TYPES,
  type PixKeyTypeOrEmpty,
} from "@/lib/payment";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const uid = useId();
  const { run, isPending } = useAdminAction();
  const [orderDeadline, setOrderDeadline] = useState(settings.orderDeadline ?? "");
  const [lastDelivery, setLastDelivery] = useState(settings.lastDeliveryDate ?? "");
  const [leadDays, setLeadDays] = useState(String(settings.minLeadDays));
  const [whatsapp, setWhatsapp] = useState(formatPhoneBR(settings.whatsappNumber));
  const [notices, setNotices] = useState(settings.noticeLines.join("\n"));
  const [deposit, setDeposit] = useState(String(settings.depositPercent));
  const [pixKeyType, setPixKeyType] = useState<PixKeyTypeOrEmpty>(settings.pixKeyType);
  const [pixKey, setPixKey] = useState(settings.pixKey);
  const [pixHolder, setPixHolder] = useState(settings.pixHolder);
  const [paymentNote, setPaymentNote] = useState(settings.paymentNote);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const lead = Number(leadDays);
    if (leadDays.trim() === "" || !Number.isInteger(lead) || lead < 0 || lead > 60) {
      setError("Antecedência mínima: informe um número de dias entre 0 e 60.");
      return;
    }
    const pct = Number(deposit);
    if (deposit.trim() === "" || !Number.isInteger(pct) || pct < 0 || pct > 100) {
      setError("Sinal: informe um número inteiro entre 0 e 100.");
      return;
    }
    if (orderDeadline && lastDelivery && lastDelivery < orderDeadline) {
      setError("A data de entrega não pode ser antes da data limite de pedidos.");
      return;
    }
    run("settings", () =>
      saveSettingsAction({
        whatsappNumber: whatsapp,
        orderDeadline,
        lastDeliveryDate: lastDelivery,
        minLeadDays: lead,
        noticeLines: notices
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        depositPercent: pct,
        pixKeyType,
        pixKey,
        pixHolder,
        paymentNote,
      }),
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      <h1 className="font-display text-3xl font-black text-choc">Configurações</h1>

      <div className="space-y-5 rounded-3xl border border-choc/25 bg-cream p-4 sm:p-5">
        <Field id={`${uid}-prazo`} label="Último dia para fazer pedidos" help="Depois desta data, o cardápio avisa que os pedidos encerraram. Deixe vazio para não ter limite.">
          <Input id={`${uid}-prazo`} type="date" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} className="h-12" />
        </Field>

        <Field id={`${uid}-entrega`} label="Última data de entrega ou retirada" help="O cliente não consegue escolher datas depois desta. Deixe vazio para não ter limite.">
          <Input id={`${uid}-entrega`} type="date" value={lastDelivery} onChange={(e) => setLastDelivery(e.target.value)} className="h-12" />
        </Field>

        <Field id={`${uid}-lead`} label="Antecedência mínima (dias)" help="Quantos dias antes o cliente precisa encomendar.">
          <Input
            id={`${uid}-lead`}
            inputMode="numeric"
            value={leadDays}
            onChange={(e) => setLeadDays(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="h-12 w-28 text-lg font-semibold"
          />
        </Field>

        <Field id={`${uid}-zap`} label="WhatsApp que recebe os pedidos" help="Com DDD. Ex.: (11) 91145-4427.">
          <Input
            id={`${uid}-zap`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value.replace(/[^\d()+\-\s]/g, "").slice(0, 24))}
            className="h-12"
          />
        </Field>

        <Field id={`${uid}-avisos`} label="Avisos no cardápio" help="Um aviso por linha. Aparecem no topo, no pedido e no rodapé.">
          <Textarea id={`${uid}-avisos`} rows={5} value={notices} onChange={(e) => setNotices(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-5 rounded-3xl border border-choc/25 bg-cream p-4 sm:p-5">
        <div>
          <h2 className="font-display text-xl font-black text-choc">Pagamento (sinal por Pix)</h2>
          <p className="mt-1 text-sm text-choc-muted">
            A confeitaria só trabalha por encomenda. Para confirmar, o cliente paga um sinal antecipado por Pix e o
            restante na entrega ou retirada. O site não cobra nada: o Pix é combinado pelo WhatsApp. O valor do sinal
            e do restante aparece no pedido e na mensagem enviada.{" "}
            <strong className="text-choc-deep">Preencha a chave Pix abaixo antes de divulgar o cardápio.</strong>
          </p>
        </div>

        <Field id={`${uid}-sinal`} label="Sinal antecipado (%)" help="Quanto o cliente paga antes, de 0 a 100. Use 50 para metade. Use 0 para desativar o sinal.">
          <Input
            id={`${uid}-sinal`}
            inputMode="numeric"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-12 w-28 text-lg font-semibold"
          />
        </Field>

        <Field id={`${uid}-pixtipo`} label="Tipo da chave Pix" help="Escolha o tipo da chave cadastrada no seu banco.">
          <select
            id={`${uid}-pixtipo`}
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value as PixKeyTypeOrEmpty)}
            className="h-12 w-full rounded-xl border border-input bg-cream px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Sem chave cadastrada</option>
            {PIX_KEY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PIX_KEY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`${uid}-pixchave`} label="Chave Pix" help="Opcional. Se ficar vazia, o cliente vê “A chave Pix será enviada na confirmação do pedido”. A chave aparece para todos no site.">
          <Input
            id={`${uid}-pixchave`}
            autoComplete="off"
            spellCheck={false}
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value.slice(0, MAX_PIX_KEY_LENGTH))}
            className="h-12"
          />
        </Field>

        <Field id={`${uid}-pixnome`} label="Nome do favorecido" help="Opcional. Nome que aparece no Pix, para o cliente conferir.">
          <Input
            id={`${uid}-pixnome`}
            autoComplete="off"
            value={pixHolder}
            onChange={(e) => setPixHolder(e.target.value.slice(0, MAX_PIX_HOLDER_LENGTH))}
            className="h-12"
          />
        </Field>

        <Field id={`${uid}-pagnota`} label="Observação sobre o pagamento" help="Opcional. Ex.: formas aceitas para o restante (Pix, dinheiro, cartão). Até 300 caracteres.">
          <Textarea
            id={`${uid}-pagnota`}
            rows={3}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value.slice(0, MAX_PAYMENT_NOTE_LENGTH))}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-destructive bg-cream p-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <i className="ri-loader-4-line animate-spin text-xl" aria-hidden="true" />
            Salvando...
          </>
        ) : (
          <>
            <i className="ri-save-line text-xl" aria-hidden="true" />
            Salvar configurações
          </>
        )}
      </Button>
    </form>
  );
}

function Field({ id, label, help, children }: { id: string; label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-choc-deep">
        {label}
      </label>
      {children}
      <p className="text-sm text-choc-muted">{help}</p>
    </div>
  );
}
