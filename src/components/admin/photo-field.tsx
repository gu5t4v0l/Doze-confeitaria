"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { resizeImage } from "@/components/admin/resize-image";
import { useToast } from "@/components/admin/toast";
import { Button } from "@/components/ui/button";

interface PhotoFieldProps {
  /** URL salva do Blob (ou null). */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Usado como parte do nome do arquivo (o Blob ainda acrescenta um sufixo aleatório). */
  baseName: string;
  emoji: string;
  onBusyChange?: (busy: boolean) => void;
}

function safeName(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "foto"
  );
}

export function PhotoField({ value, onChange, baseName, emoji, onBusyChange }: PhotoFieldProps) {
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = localPreview ?? value;

  function setBusyState(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Esse arquivo não é uma foto. Escolha uma imagem (JPG, PNG ou WebP).");
      return;
    }
    setBusyState(true);
    let preview: string | null = null;
    let blob: Blob;
    try {
      blob = await resizeImage(file);
    } catch (e) {
      console.error("[foto] não decodifica", e);
      setError("Esse arquivo não parece ser uma foto válida. Tente outra foto.");
      setBusyState(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
      return;
    }
    try {
      preview = URL.createObjectURL(blob);
      setLocalPreview(preview);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const result = await upload(`itens/${safeName(baseName)}.${ext}`, blob, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        contentType: blob.type,
      });
      onChange(result.url);
      toast.success("Foto enviada. Toque em Salvar para guardar.");
    } catch (e) {
      console.error("[foto]", e);
      setLocalPreview(null);
      setError("Não consegui enviar a foto. Confira a internet ou tente outra foto.");
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setLocalPreview(null);
      setBusyState(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-choc-deep">Foto</span>
      <div className="flex items-center gap-4">
        <div
          className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-choc/30 bg-[radial-gradient(circle_at_30%_25%,#f4f7ea,#cfd9b8_75%)]"
          aria-live="polite"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Pré-visualização da foto do item" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-5xl">
              {emoji}
            </span>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-cream/70" role="status">
              <i className="ri-loader-4-line animate-spin text-3xl text-choc" aria-hidden="true" />
              <span className="sr-only">Enviando foto</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <i className="ri-camera-line text-lg" aria-hidden="true" />
            Tirar foto
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => galleryRef.current?.click()}>
            <i className="ri-image-line text-lg" aria-hidden="true" />
            Escolher da galeria
          </Button>
          {value && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange(null)} className="text-destructive">
              <i className="ri-delete-bin-6-line text-lg" aria-hidden="true" />
              Remover foto
            </Button>
          )}
        </div>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Tirar foto com a câmera"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher foto da galeria"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-choc-muted">A foto é reduzida automaticamente para ficar leve.</p>
    </div>
  );
}
