import { describe, it, expect } from "vitest";
import { formatBRL, formatBRLCompact, formatBRLPlain, formatDateBR, formatItemCount, formatPhoneBR } from "@/lib/format";

const norm = (s: string) => s.replace(/[\s  ]/g, " ");

describe("format (preços em centavos)", () => {
  it("formatBRL usa vírgula e milhar", () => {
    expect(norm(formatBRL(123450))).toBe("R$ 1.234,50");
    expect(norm(formatBRL(0))).toBe("R$ 0,00");
  });
  it("formatBRLCompact omite centavos em inteiros e mantém quando existem", () => {
    expect(norm(formatBRLCompact(4900))).toBe("R$ 49");
    expect(norm(formatBRLCompact(4950))).toBe("R$ 49,50");
    expect(norm(formatBRLCompact(4990))).toBe("R$ 49,90");
  });
  it("formatBRLPlain não contém NBSP nem espaço fino", () => {
    const s = formatBRLPlain(1900);
    expect(s).toBe("R$ 19,00");
    expect(s).not.toMatch(/[  ]/);
  });
  it("formatDateBR converte sem fuso", () => {
    expect(formatDateBR("2026-12-24")).toBe("24/12/2026");
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
  });
  it("formatItemCount singular/plural", () => {
    expect(formatItemCount(1)).toBe("1 item");
    expect(formatItemCount(0)).toBe("0 itens");
    expect(formatItemCount(2)).toBe("2 itens");
  });
  it("formatPhoneBR", () => {
    expect(formatPhoneBR("5511911454427")).toBe("(11) 91145-4427");
    expect(formatPhoneBR("551133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneBR("123")).toBe("123");
  });
});
