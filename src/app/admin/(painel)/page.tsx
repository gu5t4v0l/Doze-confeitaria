import { Suspense } from "react";
import { AdminPanel } from "@/components/admin/admin-panel";
import { requireAdmin } from "@/lib/auth/session";
import { loadAdminData } from "@/lib/menu-queries";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-choc-deep">Carregando cardápio...</p>}>
      <Panel />
    </Suspense>
  );
}

async function Panel() {
  await requireAdmin();
  const data = await loadAdminData();
  return <AdminPanel categories={data.categories} />;
}
