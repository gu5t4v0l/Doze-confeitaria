import { Suspense } from "react";
import { AccountPanel } from "@/components/admin/account-panel";
import { requireAdmin } from "@/lib/auth/session";
import { getUserDto } from "@/lib/auth/users";

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-choc-deep">Carregando...</p>}>
      <Account />
    </Suspense>
  );
}

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const formatWhen = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "—");

async function Account() {
  const session = await requireAdmin();
  const user = await getUserDto(session.userId);
  if (!user) return <p className="text-choc-deep">Não foi possível carregar a conta.</p>;
  // só o que a tela precisa: nada de id, hash ou versão de sessão
  return (
    <AccountPanel
      email={user.email}
      displayName={user.displayName}
      lastLogin={formatWhen(user.lastLoginAt)}
      passwordChanged={formatWhen(user.passwordChangedAt)}
    />
  );
}
