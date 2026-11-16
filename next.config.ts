import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Host do nosso store de Vercel Blob (fotos), derivado do token: <storeId>.public.blob.vercel-storage.com
const blobStoreId = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
const blobHostFromToken =
  blobStoreId && /^[A-Za-z0-9]+$/.test(blobStoreId)
    ? `${blobStoreId.toLowerCase()}.public.blob.vercel-storage.com`
    : null;
if (isProd && !blobHostFromToken) {
  throw new Error(
    "Build de produção: não foi possível obter o host do Vercel Blob a partir de BLOB_READ_WRITE_TOKEN. " +
      "Defina um token válido (vercel_blob_rw_<id>_...) para não liberar o curinga *.public.blob.vercel-storage.com.",
  );
}
const blobHost = blobHostFromToken ?? "*.public.blob.vercel-storage.com";

// Fontes e ícones vêm do próprio bundle. Únicas exceções, o mínimo necessário:
// - fotos do nosso store de Blob (img-src: pré-visualização no painel);
// - upload direto do navegador ao Vercel Blob (connect-src: https://vercel.com/api/blob).
// 'unsafe-inline' em script-src é necessário para os scripts inline do Next sem nonce.
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://${blobHost}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' https://vercel.com/api/blob/ https://${blobHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: blobHost, pathname: "/itens/**" }],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
