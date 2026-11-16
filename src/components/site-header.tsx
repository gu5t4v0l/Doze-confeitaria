import Image from "next/image";
import { siteConfig } from "@/data/menu";

export function SiteHeader({ instagramHandle }: { instagramHandle: string }) {
  return (
    <header className="relative mx-auto max-w-3xl px-4 pt-6 pb-6 sm:px-6 sm:pt-10">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold tracking-[0.18em] text-choc-deep uppercase">
            {siteConfig.name}
          </p>
          <h1 className="mt-2 font-display text-[3.25rem] leading-[0.95] font-black tracking-tight text-choc sm:text-7xl">
            Cardápio
          </h1>
          <p className="mt-3 text-base font-medium text-choc-deep sm:text-lg">
            <span className="font-display text-lg font-bold text-caramel-deep italic sm:text-xl">
              {siteConfig.tagline}
            </span>
            <span aria-hidden="true" className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{siteConfig.description}</span>
          </p>
        </div>

        <Image
          src="/logo.webp"
          alt="Selo da DoZé Confeitaria: batedor de claras e a frase Feito com amor"
          width={512}
          height={512}
          priority
          sizes="(min-width: 640px) 144px, 104px"
          className="size-26 shrink-0 drop-shadow-md sm:size-36"
        />
      </div>

      <a
        href={`https://www.instagram.com/${instagramHandle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-choc/40 bg-cream/70 px-4 text-sm font-semibold text-choc-deep transition-colors hover:bg-cream"
      >
        <i className="ri-instagram-line text-lg" aria-hidden="true" />
        @{instagramHandle}
      </a>
    </header>
  );
}
