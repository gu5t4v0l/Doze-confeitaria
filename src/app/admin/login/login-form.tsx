"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-3xl border border-choc/25 bg-cream p-5 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="senha" className="text-sm font-semibold text-choc-deep">
          Senha
        </Label>
        <div className="relative">
          <Input
            id="senha"
            name="senha"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "senha-erro" : undefined}
            className="h-12 pr-14"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-choc hover:bg-sage-light/60"
          >
            <i className={visible ? "ri-eye-off-line text-xl" : "ri-eye-line text-xl"} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-0">
        {state.error && (
          <p id="senha-erro" role="alert" className="text-sm font-semibold text-destructive">
            {state.error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <i className="ri-loader-4-line animate-spin text-xl" aria-hidden="true" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
