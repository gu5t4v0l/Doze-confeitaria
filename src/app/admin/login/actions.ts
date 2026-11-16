"use server";

import "server-only";
import { redirect } from "next/navigation";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/email";
import { clearFailures, loginAccountKey, reserveLoginAttempt } from "@/lib/auth/rate-limit";
import { readSessionClaims, endAdminSession, startAdminSession } from "@/lib/auth/session";
import { readSessionSecret } from "@/lib/auth/session-token";
import { recordAudit, requestMeta } from "@/lib/auth/audit";
import { findLoginCandidate, recordLogin } from "@/lib/auth/users";

export interface LoginState {
  error?: string;
}

const MIN_DURATION_MS = 900;
/** A MESMA mensagem para e-mail inexistente, conta inativa e senha errada (sem enumeração). */
const GENERIC_ERROR = "E-mail ou senha incorretos. Tente de novo.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mesmo tempo total em qualquer resultado, para não vazar informação por timing. */
async function padTo(startedAt: number) {
  const left = MIN_DURATION_MS - (Date.now() - startedAt);
  if (left > 0) await sleep(left);
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const startedAt = Date.now();
  const email = normalizeEmail(formData.get("email"));
  const rawPassword = formData.get("senha");
  const password = typeof rawPassword === "string" ? rawPassword : "";

  let loggedIn = false;
  let state: LoginState = { error: GENERIC_ERROR };
  try {
    // falha segura: sem SESSION_SECRET válido ninguém entra (e nem tentamos)
    if (!readSessionSecret()) throw new Error("SESSION_SECRET ausente ou curto");

    const { ipHash, userAgent } = await requestMeta();
    const accountHash = loginAccountKey(email);
    // grava a tentativa como falha ANTES do scrypt (sem corrida entre requisições paralelas)
    const waitMs = await reserveLoginAttempt(ipHash, accountHash);
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
      state = { error: `Muitas tentativas. Aguarde ${minutes} min e tente de novo.` };
    } else {
      const candidate = await findLoginCandidate(email);
      const usable = candidate !== null && candidate.active;
      // SEMPRE roda o scrypt (hash fictício de custo idêntico se não há conta utilizável)
      const passwordOk = await verifyPassword(password, usable ? candidate.passwordHash : DUMMY_HASH);
      if (usable && passwordOk) {
        loggedIn = true;
        await clearFailures("login", ipHash, accountHash);
        await recordLogin(candidate.id);
        await startAdminSession(candidate.id, candidate.sessionVersion);
        await recordAudit({ event: "login_success", userId: candidate.id, ipHash, userAgent });
      } else {
        await recordAudit({
          event: "login_failure",
          userId: candidate?.id ?? null,
          // e-mail só em HMAC, e só quando a conta não existe (nunca o texto digitado)
          subjectHash: candidate ? null : accountHash,
          ipHash,
          userAgent,
        });
      }
    }
  } catch {
    loggedIn = false;
    console.error("[admin] falha no login (erro interno; detalhes omitidos).");
    state = { error: "Não foi possível entrar agora. Tente de novo em instantes." };
  }
  await padTo(startedAt);
  if (loggedIn) redirect("/admin");
  return state;
}

export async function logoutAction(): Promise<void> {
  try {
    const claims = await readSessionClaims();
    if (claims) {
      const { ipHash, userAgent } = await requestMeta();
      await recordAudit({ event: "logout", userId: claims.userId, ipHash, userAgent });
    }
  } catch {
    console.error("[admin] não foi possível registrar a saída.");
  }
  await endAdminSession();
  redirect("/admin/login");
}
