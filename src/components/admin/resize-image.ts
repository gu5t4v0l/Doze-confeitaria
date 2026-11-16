import { fitWithin, QUALITY } from "@/lib/image-resize";

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(file: File): Promise<Decoded> {
  try {
    // "from-image" respeita a rotação (EXIF) das fotos tiradas no celular
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

/** Foto do celular (vários MB) -> WebP (ou JPEG) com lado maior de ~1200px, bem leve. */
export async function resizeImage(file: File): Promise<Blob> {
  const img = await decode(file);
  try {
    const { width, height } = fitWithin(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    ctx.drawImage(img.source, 0, 0, width, height);
    const webp = await toBlob(canvas, "image/webp");
    if (webp && webp.type === "image/webp") return webp;
    const jpeg = await toBlob(canvas, "image/jpeg");
    if (!jpeg) throw new Error("falha ao comprimir");
    return jpeg;
  } finally {
    img.close();
  }
}
