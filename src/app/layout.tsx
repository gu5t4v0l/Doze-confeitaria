import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "remixicon/fonts/remixicon.css";
import "./globals.css";
import { siteConfig } from "@/data/menu";

const display = Fraunces({
  variable: "--nf-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const body = Figtree({
  variable: "--nf-body",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description =
  "Cardápio da DoZé Confeitaria: bolos, tortas, pudim e especiais de Natal feitos à mão, somente por encomenda. Feito com amor. Monte seu pedido e envie pelo WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} | Cardápio e encomendas`,
    template: `%s | ${siteConfig.name}`,
  },
  description,
  applicationName: siteConfig.name,
  keywords: ["DoZé Confeitaria", "confeitaria", "bolos", "encomendas", "Natal", "doces", "cardápio"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: siteConfig.name,
    title: `${siteConfig.name} | Cardápio e encomendas`,
    description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#B9C4A0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
