"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { clearFailures, currentIpHash, reserveLoginAttempt } from "@/lib/auth/rate-limit";
import { endAdminSession, startAdminSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

const MIN_DURATION_MS = 900;
const GENERIC_ERROR = "Senha incorreta. Tente de novo.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mesmo tempo total em qualquer resultado, para não vazar informação por timing. */
async function padTo(startedAt: number) {
  const left = MIN_DURATION_MS - (Date.now() - startedAt);
  if (left > 0) await sleep(left);
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const startedAt = Date.now();
  const raw = formData.get("senha");
  const password = typeof raw === "string" ? raw : "";
  const storedHash = process.env.ADMIN_PASSWORD_HASH ?? "";

  let ok = false;
  let state: LoginState = { error: GENERIC_ERROR };
  try {
    const ipHash = await currentIpHash();
    // grava a tentativa como falha ANTES do scrypt (sem corrida entre requisições paralelas)
    const waitMs = await reserveLoginAttempt(ipHash);
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
      state = { error: `Muitas tentativas. Aguarde ${minutes} min e tente de novo.` };
    } else {
      // sempre executa o scrypt (mesmo sem hash configurado) para manter o custo igual
      ok = await verifyPassword(password, storedHash || "scrypt:2:1:1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAA");
      if (ok) {
        await clearFailures(ipHash);
        await startAdminSession();
      }
    }
  } catch (e) {
    ok = false;
    console.error("[admin] falha no login:", e instanceof Error ? e.message : "erro desconhecido");
    state = { error: "Não foi possível entrar agora. Tente de novo em instantes." };
  }
  await padTo(startedAt);
  if (ok) redirect("/admin");
  return state;
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
