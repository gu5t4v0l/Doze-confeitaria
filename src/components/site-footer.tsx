import { siteConfig } from "@/data/menu";
import type { SiteSettings } from "@/lib/catalog-types";
import { formatPhoneBR } from "@/lib/format";
import { NoticeBanner } from "@/components/notice-banner";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-12 border-t border-choc/25 bg-choc text-cream">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div>
          <p className="font-display text-3xl font-black">{siteConfig.name}</p>
          <p className="mt-1 text-cream/85">
            {siteConfig.tagline} · {siteConfig.description}.
          </p>
        </div>

        <NoticeBanner
          lines={settings.noticeLines}
          depositPercent={settings.depositPercent}
          variant="compact"
          className="border-cream/50"
        />

        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <li>
            <a
              href={`https://www.instagram.com/${settings.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cream/50 px-4 font-semibold transition-colors hover:bg-cream/10 focus-visible:outline-cream"
            >
              <i className="ri-instagram-line text-lg" aria-hidden="true" />@{settings.instagramHandle}
            </a>
          </li>
          <li>
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cream/50 px-4 font-semibold transition-colors hover:bg-cream/10 focus-visible:outline-cream"
            >
              <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
              WhatsApp {formatPhoneBR(settings.whatsappNumber)}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
