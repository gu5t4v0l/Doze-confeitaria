import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemForm } from "@/components/admin/item-form";
import { requireAdmin } from "@/lib/auth/session";
import { loadAdminData } from "@/lib/menu-queries";

export default function EditItemPage({ params }: PageProps<"/admin/item/[id]">) {
  return (
    <Suspense fallback={<p className="text-choc-deep">Carregando...</p>}>
      <EditItem params={params} />
    </Suspense>
  );
}

async function EditItem({ params }: { params: PageProps<"/admin/item/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();
  const { categories } = await loadAdminData();
  const item = categories.flatMap((c) => c.items).find((i) => i.id === itemId);
  if (!item) notFound();
  return (
    <ItemForm
      item={item}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
