import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/auth/password-policy";
import { isValidEmail, maskEmail, normalizeEmail } from "@/lib/auth/email";

const ok = (pw: string, ctx = {}) => validateNewPassword(pw, ctx).ok;
const err = (pw: string, ctx = {}) => {
  const r = validateNewPassword(pw, ctx);
  return r.ok ? "" : r.error;
};

describe("política de senha", () => {
  it("limites: 11 recusa, 12 aceita, 128 aceita, 129 recusa", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(ok("a1b2c3d4e5f")).toBe(false);
    expect(ok("pao de mel azul")).toBe(true);
    expect(ok("xK9" + "q".repeat(9))).toBe(true);
    expect(ok("xK9" + "q".repeat(125))).toBe(true);
    expect(ok("xK9" + "q".repeat(126))).toBe(false);
    expect(err("curta")).toContain("frase longa");
  });
  it("não exige símbolo nem maiúscula: frase longa vale", () => {
    expect(ok("meu bolo favorito de laranja")).toBe(true);
  });
  it("recusa senhas comuns (mesmo com maiúsculas/pontuação) e repetições", () => {
    expect(ok("password12345")).toBe(false);
    expect(ok("Senha 12345678")).toBe(false);
    expect(ok("QWERTYUIOPAS")).toBe(false);
    expect(ok("DoZe-Confeitaria")).toBe(false);
    expect(ok("aaaaaaaaaaaaaa")).toBe(false);
    expect(ok("            ")).toBe(false);
  });
  it("recusa conter o e-mail ou a parte local", () => {
    const ctx = { email: "maria.silva@exemplo.com" };
    expect(err("minha-maria.silva@exemplo.com-x", ctx)).toContain("e-mail");
    expect(err("MariaSilva é uma ótima doceira", ctx)).toContain("e-mail");
    expect(ok("brigadeiro de colher cremoso", ctx)).toBe(true);
    // parte local curta (menos de 4) não bloqueia por coincidência
    expect(ok("ana gosta de bolo de cenoura", { email: "ana@exemplo.com" })).toBe(true);
  });
  it("recusa igual à atual (comparando NFKC)", () => {
    expect(err("uma frase bem longa aqui", { currentPassword: "uma frase bem longa aqui" })).toContain("diferente");
    expect(ok("uma frase bem longa aqui!", { currentPassword: "uma frase bem longa aqui" })).toBe(true);
    // forma "fullwidth" normaliza para a mesma senha
    expect(ok("ｕｍａ frase bem longa aqui", { currentPassword: "uma frase bem longa aqui" })).toBe(false);
  });
  it("unicode: conta pontos de código (emoji e acentos) e normaliza NFKC", () => {
    expect(ok("açaí com granola é bom")).toBe(true);
    expect("😀😀😀😀😀😀😀😀😀😀😀".length).toBeGreaterThan(11); // 22 unidades UTF-16...
    expect(ok("😀😀😀😀😀😀😀😀😀😀😀")).toBe(false); // ...mas só 11 caracteres
    expect(ok("😀😀😀😀😀😀😀😀😀😀😀😀")).toBe(false); // 12 emojis iguais = repetição de um caractere
    expect(ok("😀😁😂🤣😃😄😅😆😉😊😋😎")).toBe(true);
  });
});

describe("e-mail", () => {
  it("normaliza (NFKC, minúsculo, trim) e valida", () => {
    expect(normalizeEmail("  Teste@Exemplo.INVALID ")).toBe("teste@exemplo.invalid");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
    expect(isValidEmail("teste@exemplo.invalid")).toBe(true);
    for (const bad of ["", "a@b", "sem arroba.com", "a b@c.com", "@x.com", "a@@x.com", "a@x.c om"]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
    expect(isValidEmail("a".repeat(250) + "@x.com")).toBe(false);
  });
  it("máscara de log nunca mostra o e-mail inteiro", () => {
    expect(maskEmail("maria@exemplo.com")).toBe("m***@exemplo.com");
    expect(maskEmail("lixo")).toBe("***");
  });
});
