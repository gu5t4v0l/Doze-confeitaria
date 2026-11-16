import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash de senha com scrypt (node:crypto).
 * Formato: `scrypt:N:r:p:saltBase64url:hashBase64url`
 * (sem "$" de propósito: arquivos .env expandem "$VAR").
 */
const PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_PASSWORD_LENGTH = 256;

function derive(password: string, salt: Buffer, opts: ScryptOptions, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, keyLen, { ...opts, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) throw new Error("Senha inválida.");
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, PARAMS, KEY_LEN);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

export function parseHash(stored: string): ParsedHash | null {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every(Number.isInteger) || N < 2 || (N & (N - 1)) !== 0 || N > 1 << 20) return null;
  if (r < 1 || r > 32 || p < 1 || p > 16) return null;
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length < 8 || key.length < 16) return null;
  return { N, r, p, salt, key };
}

/** Compara em tempo constante. Hash malformado ou senha enorme => false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed || !password || password.length > MAX_PASSWORD_LENGTH) return false;
  const key = await derive(password, parsed.salt, { N: parsed.N, r: parsed.r, p: parsed.p }, parsed.key.length);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/**
 * Hash FICTÍCIO com os MESMOS parâmetros do real (custo idêntico): usado quando o usuário não existe
 * ou está inativo, para o scrypt rodar igual e o tempo não revelar nada. Não corresponde a nenhuma senha.
 */
export const DUMMY_HASH = ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, "A".repeat(22), "A".repeat(86)].join(":");
