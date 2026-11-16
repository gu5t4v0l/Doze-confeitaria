/**
 * Política de senha (pura, sem I/O). Sem exigir símbolos: comprimento e frases longas valem mais.
 * Normalização NFKC, a mesma do hash (password.ts).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_HINT = "Use uma frase longa, de fácil lembrança, com 12 caracteres ou mais (ex.: três palavras que só você junta).";

/** Lista curta embutida (já normalizada: minúsculas, só letras e números). */
const COMMON = new Set(
  [
    "123456789012", "1234567890123", "12345678901234", "111111111111", "000000000000", "123123123123",
    "password1234", "password12345", "passw0rd1234", "senha1234567", "senha12345678", "senhasenhasenha",
    "mudar123456", "mudarsenha123", "trocar123456", "qwertyuiop12", "qwertyuiopas", "qwertyuiopasdf",
    "qwerty123456", "qwertyqwerty", "asdfghjkl123", "asdfghjklzxcv", "zxcvbnm12345", "abcdefghijkl",
    "abc123abc123", "iloveyou1234", "letmein12345", "welcome12345", "administrador", "administrador1",
    "admin1234567", "admin12345678", "adminadmin12", "painel123456", "painelpainel", "doze12345678",
    "dozeconfeitaria", "dozeconfeitaria1", "dozeconfeitaria123", "confeitaria123", "confeitaria1234",
    "bolodechocolate", "brigadeiro123", "docinhos12345", "minhasenha123", "minhasenhasecreta",
    "senhasecreta12", "senhaforte1234", "1q2w3e4r5t6y", "1qaz2wsx3edc", "q1w2e3r4t5y6", "mariaantonia1",
    "brasilbrasil1", "brasil123456", "flamengo1234", "corinthians12", "palmeiras1234", "futebol12345",
    "123456abcdef", "abcdef123456", "a1b2c3d4e5f6", "pass12345678", "test12345678", "teste1234567",
  ].map((s) => s.toLowerCase()),
);

function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export type PolicyResult = { ok: true } | { ok: false; error: string };

export interface PolicyContext {
  /** E-mail do usuário (a senha não pode conter ele nem a parte antes do @). */
  email?: string;
  /** Senha atual em claro (já confirmada), para recusar "igual à atual". */
  currentPassword?: string;
}

export function validateNewPassword(password: string, ctx: PolicyContext = {}): PolicyResult {
  const pw = password.normalize("NFKC");
  const length = Array.from(pw).length;
  if (length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres. ${PASSWORD_HINT}` };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.` };
  }
  if (pw.trim().length === 0) return { ok: false, error: "A senha não pode ser só espaços." };

  const flat = squash(pw);
  if (new Set(Array.from(pw.replace(/[\s]/g, ""))).size === 1) {
    return { ok: false, error: "Essa senha é fácil demais de adivinhar. " + PASSWORD_HINT };
  }
  if (COMMON.has(flat)) {
    return { ok: false, error: "Essa senha é muito comum e fácil de adivinhar. " + PASSWORD_HINT };
  }
  if (ctx.currentPassword !== undefined && pw === ctx.currentPassword.normalize("NFKC")) {
    return { ok: false, error: "A nova senha precisa ser diferente da atual." };
  }
  if (ctx.email) {
    const email = ctx.email.normalize("NFKC").toLowerCase();
    const local = email.split("@")[0] ?? "";
    const lowered = pw.toLowerCase();
    if (lowered.includes(email) || (squash(local).length >= 4 && flat.includes(squash(local)))) {
      return { ok: false, error: "A senha não pode conter o seu e-mail." };
    }
  }
  return { ok: true };
}

/** Gera uma senha forte (sem 0/O/1/l/I) para o `--generate` dos scripts. 20 caracteres em 4 grupos. */
export const GENERATED_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
