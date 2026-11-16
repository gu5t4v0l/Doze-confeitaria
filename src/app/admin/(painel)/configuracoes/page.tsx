import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/auth/session";
import { loadAdminData } from "@/lib/menu-queries";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-choc-deep">Carregando...</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireAdmin();
  const { settings } = await loadAdminData();
  return <SettingsForm settings={settings} />;
}
