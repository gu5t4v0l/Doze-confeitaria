import { Suspense } from "react";
import { CartBar } from "@/components/cart-bar";
import { CatalogProvider } from "@/components/catalog-provider";
import { CategoryNav } from "@/components/category-nav";
import { MenuSection } from "@/components/menu-section";
import { NoticeBanner } from "@/components/notice-banner";
import { OrdersClosedNotice } from "@/components/orders-closed-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicCatalog } from "@/lib/menu-queries";

export default function Home() {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <Menu />
    </Suspense>
  );
}

async function Menu() {
  const catalog = await getPublicCatalog();
  const tabs = catalog.categories.map((c) => ({ id: c.id, label: c.title, emoji: c.emoji }));

  return (
    <CatalogProvider catalog={catalog}>
      <SiteHeader instagramHandle={catalog.settings.instagramHandle} />
      <div className="mx-auto max-w-3xl space-y-3 px-4 pb-6 sm:px-6">
        <OrdersClosedNotice />
        <NoticeBanner lines={catalog.settings.noticeLines} depositPercent={catalog.settings.depositPercent} />
      </div>
      {tabs.length > 0 && <CategoryNav tabs={tabs} />}
      <main className="mx-auto max-w-3xl pb-4">
        {catalog.categories.length === 0 ? (
          <p className="mx-4 mt-8 rounded-2xl border-2 border-dashed border-choc/50 bg-cream p-6 text-center font-medium text-choc-deep">
            Estamos preparando o cardápio. Volte em instantes!
          </p>
        ) : (
          catalog.categories.map((category) => <MenuSection key={category.id} category={category} />)
        )}
      </main>
      <SiteFooter settings={catalog.settings} />
      {/* espaço para a barra flutuante do carrinho não cobrir o rodapé */}
      <div aria-hidden="true" className="h-24" />
      <CartBar />
    </CatalogProvider>
  );
}

function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6" aria-busy="true" aria-label="Carregando cardápio">
      <div className="h-16 w-56 animate-pulse rounded-2xl bg-cream/60" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl bg-cream/60" />
        ))}
      </div>
    </div>
  );
}
