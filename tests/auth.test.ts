import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import { DUMMY_HASH, hashPassword, parseHash, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, readSessionSecret, verifySessionToken } from "@/lib/auth/session-token";
import { ACCOUNT_BACKOFF, ACCOUNT_FAILURE_THRESHOLD, GLOBAL_FAILURE_THRESHOLD, IP_FAILURE_THRESHOLD, LOCKOUT_WINDOW_MS, lockoutRemainingMs } from "@/lib/auth/lockout";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

const SECRET = "x".repeat(40);
const createHmacKey = () => new Uint8Array(createHmac("sha256", SECRET).update("doze:session").digest());

describe("senha (scrypt)", () => {
  it("hash tem formato com parâmetros e salt, sem '$' e sem a senha", async () => {
    const h = await hashPassword("Senha-Forte-123");
    expect(h).toMatch(/^scrypt:32768:8:1:[\w-]+:[\w-]+$/);
    expect(h).not.toContain("$");
    expect(h).not.toContain("Senha-Forte-123");
    expect(parseHash(h)).not.toBeNull();
  });
  it("senha certa passa; errada, vazia e quase certa falham", async () => {
    const h = await hashPassword("Senha-Forte-123");
    expect(await verifyPassword("Senha-Forte-123", h)).toBe(true);
    expect(await verifyPassword("senha-forte-123", h)).toBe(false);
    expect(await verifyPassword("Senha-Forte-1234", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });
  it("mesmo texto gera hashes diferentes (salt aleatório)", async () => {
    expect(await hashPassword("abc12345678")).not.toBe(await hashPassword("abc12345678"));
  });
  it("hash malformado, parâmetros absurdos e senha gigante => false (sem lançar)", async () => {
    for (const bad of ["", "lixo", "scrypt:1:2:3", "bcrypt:1:1:1:AAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAA", "scrypt:3:8:1:AAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAA", "scrypt:999999999:8:1:AAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAA"]) {
      expect(await verifyPassword("qualquer", bad), bad).toBe(false);
    }
    const h = await hashPassword("abc12345678");
    expect(await verifyPassword("a".repeat(5000), h)).toBe(false);
  });
  it("rejeita senha vazia ao gerar", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});

describe("sessão assinada (JWT HS256, sub + sv)", () => {
  const claims = { userId: 7, sessionVersion: 3 };
  const now = new Date("2026-11-15T12:00:00Z");

  it("token válido é aceito e devolve sub/sv", async () => {
    const t = await createSessionToken(SECRET, claims, now);
    expect(await verifySessionToken(t, SECRET, now)).toEqual(claims);
    expect(await verifySessionToken(t, SECRET, new Date(now.getTime() + 47 * 3600_000))).toEqual(claims);
  });
  it("não carrega e-mail, hash nem senha no token", async () => {
    const t = await createSessionToken(SECRET, claims, now);
    const payload = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "sub", "sv"]);
    expect(payload.sub).toBe("7");
  });
  it("expira em 48 h", async () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(48 * 60 * 60);
    const t = await createSessionToken(SECRET, claims, now);
    const after = new Date(now.getTime() + (SESSION_MAX_AGE_SECONDS + 5) * 1000);
    expect(await verifySessionToken(t, SECRET, after)).toBeNull();
  });
  it("adulterado (payload ou assinatura) é recusado", async () => {
    const t = await createSessionToken(SECRET, claims, now);
    const [h, p, s] = t.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), sub: "1", sv: 99 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`, SECRET, now)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s.slice(0, -2)}AA`, SECRET, now)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.`, SECRET, now)).toBeNull();
  });
  it("segredo diferente é recusado", async () => {
    const t = await createSessionToken(SECRET, claims, now);
    expect(await verifySessionToken(t, "y".repeat(40), now)).toBeNull();
  });
  it("alg none / outro algoritmo / outro emissor é recusado", async () => {
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "7", sv: 1, iss: "doze-confeitaria", aud: "admin", exp: 9999999999 })).toString("base64url")}.`;
    expect(await verifySessionToken(unsigned, SECRET, now)).toBeNull();
    const hs512 = await new SignJWT({ sv: 1 })
      .setProtectedHeader({ alg: "HS512" }).setIssuer("doze-confeitaria").setAudience("admin").setSubject("7")
      .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(hs512, SECRET, new Date())).toBeNull();
    const other = await new SignJWT({ sv: 1 })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("outro").setAudience("admin").setSubject("7")
      .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(other, SECRET, new Date())).toBeNull();
  });
  it("token no formato antigo (sub 'admin', sem sv) é recusado", async () => {
    const old = await new SignJWT({ pwv: "abc" })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("doze-confeitaria").setAudience("admin").setSubject("admin")
      .setExpirationTime("1h").sign(createHmacKey());
    expect(await verifySessionToken(old, SECRET, new Date())).toBeNull();
  });
  it("ausente/vazio/lixo => null; segredo curto => não cria token e não valida", async () => {
    expect(await verifySessionToken(undefined, SECRET, now)).toBeNull();
    expect(await verifySessionToken("", SECRET, now)).toBeNull();
    await expect(createSessionToken("curto", claims, now)).rejects.toThrow();
    await expect(createSessionToken(SECRET, { userId: 0, sessionVersion: 1 }, now)).rejects.toThrow();
    expect(await verifySessionToken("a.b.c", "curto", now)).toBeNull();
  });
  it("readSessionSecret: <32 caracteres ou ausente => null", () => {
    const old = process.env.SESSION_SECRET;
    try {
      delete process.env.SESSION_SECRET;
      expect(readSessionSecret()).toBeNull();
      process.env.SESSION_SECRET = "x".repeat(31);
      expect(readSessionSecret()).toBeNull();
      process.env.SESSION_SECRET = "x".repeat(32);
      expect(readSessionSecret()).toBe("x".repeat(32));
    } finally {
      if (old === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = old;
    }
  });
});

describe("hash fictício", () => {
  it("tem o mesmo custo do hash real e nunca confere", async () => {
    expect(DUMMY_HASH).toMatch(/^scrypt:32768:8:1:/);
    expect(parseHash(DUMMY_HASH)).not.toBeNull();
    expect(await verifyPassword("qualquer coisa", DUMMY_HASH)).toBe(false);
  });
});

describe("bloqueio progressivo de login", () => {
  const now = 1_000_000_000_000;
  const fails = (n: number, agoMs = 1000) => Array.from({ length: n }, (_, i) => now - agoMs - i);

  it("abaixo do limite não bloqueia", () => {
    expect(lockoutRemainingMs(fails(IP_FAILURE_THRESHOLD - 1), now, IP_FAILURE_THRESHOLD)).toBe(0);
  });
  it("5 falhas: ~1 min a partir da última", () => {
    const ms = lockoutRemainingMs(fails(5, 10_000), now, IP_FAILURE_THRESHOLD);
    expect(ms).toBe(60_000 - 10_000);
  });
  it("a espera cresce (2, 4, 8 min) e é limitada a 15 min", () => {
    const w = (n: number) => lockoutRemainingMs(fails(n, 0), now, IP_FAILURE_THRESHOLD);
    expect(w(6)).toBe(120_000);
    expect(w(7)).toBe(240_000);
    expect(w(8)).toBe(480_000);
    expect(w(30)).toBe(LOCKOUT_WINDOW_MS);
  });
  it("libera depois da espera e ignora falhas fora da janela de 15 min", () => {
    expect(lockoutRemainingMs(fails(5, 61_000), now, IP_FAILURE_THRESHOLD)).toBe(0);
    expect(lockoutRemainingMs(fails(20, LOCKOUT_WINDOW_MS + 1), now, IP_FAILURE_THRESHOLD)).toBe(0);
  });
  it("limite por conta: acima do por IP, espera curta (30 s a 5 min) para não trancar a dona por muito tempo", () => {
    expect(ACCOUNT_FAILURE_THRESHOLD).toBeGreaterThan(IP_FAILURE_THRESHOLD);
    const w = (n: number) => lockoutRemainingMs(fails(n, 0), now, ACCOUNT_FAILURE_THRESHOLD, LOCKOUT_WINDOW_MS, ACCOUNT_BACKOFF);
    expect(w(ACCOUNT_FAILURE_THRESHOLD - 1)).toBe(0);
    expect(w(ACCOUNT_FAILURE_THRESHOLD)).toBe(30_000);
    expect(w(ACCOUNT_FAILURE_THRESHOLD + 1)).toBe(60_000);
    expect(w(500)).toBe(ACCOUNT_BACKOFF.maxMs);
  });
  it("limite global é bem maior que o por IP", () => {
    expect(GLOBAL_FAILURE_THRESHOLD).toBeGreaterThan(IP_FAILURE_THRESHOLD);
    expect(lockoutRemainingMs(fails(10, 0), now, GLOBAL_FAILURE_THRESHOLD)).toBe(0);
    expect(lockoutRemainingMs(fails(GLOBAL_FAILURE_THRESHOLD, 0), now, GLOBAL_FAILURE_THRESHOLD)).toBeGreaterThan(0);
  });
});
