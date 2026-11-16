import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "DoZé Confeitaria - Cardápio e encomendas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo-og.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: "#B9C4A0",
          color: "#7A2E12",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={420} height={420} alt="" />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1 }}>DoZé Confeitaria</div>
          <div style={{ fontSize: 40, marginTop: 20, color: "#4A1D0B" }}>
            Cardápio e encomendas pelo WhatsApp
          </div>
          <div style={{ fontSize: 36, marginTop: 14, color: "#6F4119", fontStyle: "italic" }}>
            Feito com amor
          </div>
        </div>
      </div>
    ),
    size,
  );
}
