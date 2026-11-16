import { Suspense } from "react";
import { ItemForm } from "@/components/admin/item-form";
import { requireAdmin } from "@/lib/auth/session";
import { loadAdminData } from "@/lib/menu-queries";

export default function NewItemPage() {
  return (
    <Suspense fallback={<p className="text-choc-deep">Carregando...</p>}>
      <NewItem />
    </Suspense>
  );
}

async function NewItem() {
  await requireAdmin();
  const { categories } = await loadAdminData();
  return (
    <ItemForm
      item={null}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
