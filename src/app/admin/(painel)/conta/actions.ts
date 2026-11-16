"use server";

import "server-only";
import { redirect } from "next/navigation";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { clearFailures, passwordAccountKey, reservePasswordAttempt } from "@/lib/auth/rate-limit";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/auth/session";
import { recordAudit, requestMeta } from "@/lib/auth/audit";
import { changePassword, getPasswordHash, getUserDto, revokeSessions } from "@/lib/auth/users";

/** DTO mínimo devolvido ao navegador: nada além disto. */
export interface AccountState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const GENERIC = "Não foi possível concluir agora. Tente de novo em instantes.";
const MAX_FIELD = 256;

const field = (fd: FormData, name: string): string => {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
};

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const session = await requireAdmin();
  const current = field(formData, "atual");
  const next = field(formData, "nova");
  const confirm = field(formData, "confirmar");

  if (!current || !next || !confirm) return { error: "Preencha os três campos." };
  if (current.length > MAX_FIELD || next.length > MAX_FIELD) return { error: "Senha longa demais." };
  if (next !== confirm) return { error: "A confirmação não é igual à nova senha." };

  try {
    const { ipHash, userAgent } = await requestMeta();
    const accountKey = passwordAccountKey(session.userId);
    // tentativas erradas da senha atual contam (reserva ANTES do scrypt)
    const waitMs = await reservePasswordAttempt(ipHash, accountKey);
    if (waitMs > 0) {
      return { error: `Muitas tentativas. Aguarde ${Math.max(1, Math.ceil(waitMs / 60_000))} min e tente de novo.` };
    }

    const oldHash = await getPasswordHash(session.userId);
    const currentOk = await verifyPassword(current, oldHash ?? DUMMY_HASH);
    if (!oldHash || !currentOk) return { error: "A senha atual não confere." };
    // senha atual correta: não pune quem só errou a nova senha
    await clearFailures("password", ipHash, accountKey);

    const user = await getUserDto(session.userId);
    if (!user) return { error: GENERIC };
    const policy = validateNewPassword(next, { email: user.email, currentPassword: current });
    if (!policy.ok) return { error: policy.error };

    const newHash = await hashPassword(next);
    const newVersion = await changePassword(session.userId, oldHash, newHash);
    if (newVersion === null) return { error: "A senha mudou em outro aparelho. Recarregue a página e tente de novo." };

    // derrubou todas as outras sessões (session_version + 1); este aparelho recebe uma sessão nova
    await startAdminSession(session.userId, newVersion);
    await recordAudit({ event: "password_changed", userId: session.userId, ipHash, userAgent });
    return { ok: true, message: "Senha trocada. Os outros aparelhos foram desconectados." };
  } catch {
    console.error("[admin] falha ao trocar a senha (detalhes omitidos).");
    return { error: GENERIC };
  }
}

export async function revokeAllSessionsAction(): Promise<AccountState> {
  const session = await requireAdmin();
  try {
    const { ipHash, userAgent } = await requestMeta();
    if (await revokeSessions(session.userId)) {
      await recordAudit({ event: "sessions_revoked", userId: session.userId, ipHash, userAgent });
    }
  } catch {
    console.error("[admin] falha ao encerrar as sessões (detalhes omitidos).");
    return { error: GENERIC };
  }
  // todas as sessões (inclusive esta) deixam de valer: volta ao login
  await endAdminSession();
  redirect("/admin/login");
}
