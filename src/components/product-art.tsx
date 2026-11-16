import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductArtProps {
  imageUrl: string | null;
  emoji: string;
  tone: "default" | "festive";
  className?: string;
}

/** Foto do produto (quando houver) ou placeholder ilustrado (gradiente + emoji). */
export function ProductArt({ imageUrl, emoji, tone, className }: ProductArtProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid size-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-2xl border border-choc/25 sm:size-20",
        tone === "festive"
          ? "bg-[radial-gradient(circle_at_30%_25%,#fff7e0,#e6d2a8_75%)]"
          : "bg-[radial-gradient(circle_at_30%_25%,#f4f7ea,#cfd9b8_75%)]",
        className,
      )}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes="80px" className="object-cover" />
      ) : (
        <span className="text-4xl drop-shadow-sm select-none">{emoji}</span>
      )}
    </div>
  );
}
