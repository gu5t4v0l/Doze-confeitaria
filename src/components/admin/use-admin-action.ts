"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/admin/toast";
import type { ActionResult } from "@/app/admin/actions";

/**
 * Sem sessão, /admin/login responde 200; com sessão válida o proxy a redireciona para /admin.
 * Falha de rede (fetch rejeita) = não dá para saber: devolve false e o chamador mostra o erro de conexão.
 */
async function sessionExpired(): Promise<boolean> {
  try {
    const res = await fetch("/admin/login", { redirect: "manual", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Executa uma Server Action com feedback: "pending" (para desativar botões),
 * aviso de sucesso/erro e atualização da tela. Falha de rede vira mensagem amigável.
 */
export function useAdminAction() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    <T,>(
      key: string,
      action: () => Promise<ActionResult<T>>,
      onOk?: (result: Extract<ActionResult<T>, { ok: true }>) => void,
    ) => {
      setBusyKey(key);
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            toast.success(result.message);
            onOk?.(result);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        } catch {
          if (await sessionExpired()) {
            // o proxy redirecionou a Server Action para o login: volta para lá, em vez de acusar "sem conexão"
            router.replace("/admin/login");
            return;
          }
          toast.error("Sem conexão com o servidor. Confira a internet e tente de novo.");
        } finally {
          setBusyKey(null);
        }
      });
    },
    [router, toast],
  );

  return { run, isPending, busyKey };
}
