/** Hospedagem das fotos: Vercel Blob (store público). Funções puras. */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
export const BLOB_PATH_PREFIX = "itens/";

/**
 * Host do nosso store, derivado do token (`vercel_blob_rw_<storeId>_<segredo>`).
 * Só o storeId (não secreto) é usado.
 */
export function blobStoreHost(token: string | undefined = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3];
  if (!storeId || !/^[A-Za-z0-9]+$/.test(storeId)) return null;
  return `${storeId.toLowerCase()}${BLOB_HOST_SUFFIX}`;
}

/**
 * A URL pertence ao nosso store de Blob? https, host `<store>.public.blob.vercel-storage.com`
 * (exatamente o nosso, quando conhecido) e caminho dentro de `itens/`.
 */
export function isAllowedBlobUrl(value: string, storeHost: string | null = blobStoreHost()): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(BLOB_HOST_SUFFIX) || host.length <= BLOB_HOST_SUFFIX.length) return false;
  if (storeHost && host !== storeHost.toLowerCase()) return false;
  if (!url.pathname.startsWith(`/${BLOB_PATH_PREFIX}`)) return false;
  return !url.pathname.includes("..");
}
