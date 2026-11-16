"use client";

import { useActionState, useState } from "react";
import {
  changePasswordAction,
  revokeAllSessionsAction,
  type AccountState,
} from "@/app/admin/(painel)/conta/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AccountState = {};

interface Props {
  email: string;
  displayName: string;
  lastLogin: string;
  passwordChanged: string;
}

export function AccountPanel({ email, displayName, lastLogin, passwordChanged }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-choc">Minha conta</h1>

      <section aria-labelledby="dados" className="space-y-2 rounded-3xl border border-choc/25 bg-cream p-5 shadow-sm">
        <h2 id="dados" className="font-display text-xl font-black text-choc">
          Seus dados
        </h2>
        <dl className="space-y-2 text-choc-deep">
          {displayName && (
            <div>
              <dt className="text-sm font-semibold">Nome</dt>
              <dd>{displayName}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-semibold">E-mail de acesso</dt>
            <dd className="break-all">{email}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Último acesso</dt>
            <dd>{lastLogin}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Senha alterada em</dt>
            <dd>{passwordChanged}</dd>
          </div>
        </dl>
      </section>

      <PasswordForm />
      <RevokeForm />
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-choc-deep">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={256}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={hint ? `${id}-dica` : undefined}
          className="h-12 pr-14"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Esconder: ${label}` : `Mostrar: ${label}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-choc hover:bg-sage-light/60"
        >
          <i className={visible ? "ri-eye-off-line text-xl" : "ri-eye-line text-xl"} aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <p id={`${id}-dica`} className="text-sm text-choc-deep">
          {hint}
        </p>
      )}
    </div>
  );
}

function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, INITIAL);
  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-choc/25 bg-cream p-5 shadow-sm">
      <h2 className="font-display text-xl font-black text-choc">Trocar a senha</h2>
      <PasswordField id="atual" name="atual" label="Senha atual" autoComplete="current-password" />
      <PasswordField
        id="nova"
        name="nova"
        label="Nova senha"
        autoComplete="new-password"
        hint="Use uma frase longa, com 12 caracteres ou mais (até 128). Não precisa de símbolos."
      />
      <PasswordField id="confirmar" name="confirmar" label="Repita a nova senha" autoComplete="new-password" />

      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p role="status" className="text-sm font-semibold text-choc-deep">
            <i className="ri-check-line mr-1" aria-hidden="true" />
            {state.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <i className="ri-loader-4-line animate-spin text-xl" aria-hidden="true" />
            Salvando...
          </>
        ) : (
          "Trocar senha"
        )}
      </Button>
    </form>
  );
}

function RevokeForm() {
  const [state, formAction, pending] = useActionState(revokeAllSessionsAction, INITIAL);
  return (
    <form action={formAction} className="space-y-3 rounded-3xl border border-choc/25 bg-cream p-5 shadow-sm">
      <h2 className="font-display text-xl font-black text-choc">Sair de todos os aparelhos</h2>
      <p className="text-choc-deep">
        Use se perdeu o celular ou entrou em um aparelho que não é seu. Você precisará entrar de novo, aqui também.
      </p>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="outline" size="lg" className="w-full" disabled={pending}>
        <i className="ri-logout-box-r-line text-xl" aria-hidden="true" />
        {pending ? "Saindo..." : "Sair de todos os aparelhos"}
      </Button>
    </form>
  );
}
