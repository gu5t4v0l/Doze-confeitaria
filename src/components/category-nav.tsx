"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  emoji: string;
}

export function CategoryNav({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // faixa fina logo abaixo da barra fixa
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav
      aria-label="Categorias do cardápio"
      className="sticky top-0 z-30 border-y border-choc/20 bg-sage/90 backdrop-blur supports-[backdrop-filter]:bg-sage/80"
    >
      <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-choc bg-choc text-cream"
                    : "border-choc/40 bg-cream/60 text-choc-deep hover:bg-cream",
                )}
              >
                <span aria-hidden="true">{tab.emoji}</span>
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
