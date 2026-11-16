"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Cardápio", icon: "ri-cake-3-line" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "ri-settings-3-line" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do painel" className="flex gap-2">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/item") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              active
                ? "border-choc bg-choc text-cream"
                : "border-choc/40 bg-cream/60 text-choc-deep hover:bg-cream",
            )}
          >
            <i className={cn(l.icon, "text-lg")} aria-hidden="true" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
