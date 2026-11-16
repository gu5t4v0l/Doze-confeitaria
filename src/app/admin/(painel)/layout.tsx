import Image from "next/image";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-choc/25 bg-sage/90">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-3">
              <Image src="/logo.webp" alt="" width={512} height={512} sizes="56px" className="size-14 shrink-0" />
              <div>
                <p className="font-display text-xl leading-tight font-black whitespace-nowrap text-choc">Painel da DoZé</p>
                <p className="text-sm whitespace-nowrap text-choc-deep">Cardápio e configurações</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-choc/40 bg-cream/70 px-3 text-sm font-semibold text-choc-deep hover:bg-cream"
              >
                <i className="ri-external-link-line text-lg" aria-hidden="true" />
                <span>Ver cardápio</span>
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="rounded-full px-3">
                  <i className="ri-logout-box-r-line text-lg" aria-hidden="true" />
                  Sair
                </Button>
              </form>
            </div>
          </div>
          <Suspense fallback={<div className="h-11" />}>
            <AdminNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Suspense fallback={<PanelSkeleton />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

/** Reverifica a sessão no servidor para tudo que está sob /admin (além do proxy). */
async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

function PanelSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-cream/60" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-cream/60" />
      ))}
    </div>
  );
}
