import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/auth/session";
import { BLOB_PATH_PREFIX } from "@/lib/blob-url";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Emite o token de upload direto ao Vercel Blob (o corpo de uma Function é limitado a 4,5 MB,
 * por isso o navegador envia a foto direto ao Blob). Só com sessão de admin.
 */
export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // O aviso "upload concluído" vem da própria Vercel (assinado, verificado por handleUpload).
  // Já a emissão do token só acontece para quem tem sessão de admin válida.
  if (body.type === "blob.generate-client-token" && !(await isAdmin())) {
    return Response.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(BLOB_PATH_PREFIX) || pathname.includes("..") || pathname.length > 200) {
          throw new Error("Caminho de arquivo não permitido.");
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // nada a fazer: quem grava a URL é a ação "salvar item" (que a valida de novo)
      },
    });
    return Response.json(result);
  } catch (e) {
    console.error("[upload] falha:", e instanceof Error ? e.message : "desconhecido");
    return Response.json({ error: "Não foi possível enviar a foto." }, { status: 400 });
  }
}
