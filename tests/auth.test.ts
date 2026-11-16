import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { hashPassword, parseHash, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, passwordFingerprint, verifySessionToken } from "@/lib/auth/session-token";
import { GLOBAL_FAILURE_THRESHOLD, IP_FAILURE_THRESHOLD, LOCKOUT_WINDOW_MS, lockoutRemainingMs } from "@/lib/auth/lockout";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-config";

const SECRET = "x".repeat(40);

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

describe("sessão assinada (JWT HS256)", () => {
  const ctx = { secret: SECRET, passwordHash: "scrypt:fake-hash" };
  const now = new Date("2026-11-15T12:00:00Z");

  it("token válido é aceito", async () => {
    const t = await createSessionToken(ctx, now);
    expect(await verifySessionToken(t, ctx, now)).toBe(true);
    expect(await verifySessionToken(t, ctx, new Date(now.getTime() + 47 * 3600_000))).toBe(true);
  });
  it("expira em 48 h", async () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(48 * 60 * 60);
    const t = await createSessionToken(ctx, now);
    const after = new Date(now.getTime() + (SESSION_MAX_AGE_SECONDS + 5) * 1000);
    expect(await verifySessionToken(t, ctx, after)).toBe(false);
  });
  it("adulterado (payload ou assinatura) é recusado", async () => {
    const t = await createSessionToken(ctx, now);
    const [h, p, s] = t.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), exp: 9999999999 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`, ctx, now)).toBe(false);
    expect(await verifySessionToken(`${h}.${p}.${s.slice(0, -2)}AA`, ctx, now)).toBe(false);
    expect(await verifySessionToken(`${h}.${p}.`, ctx, now)).toBe(false);
  });
  it("segredo diferente é recusado", async () => {
    const t = await createSessionToken(ctx, now);
    expect(await verifySessionToken(t, { ...ctx, secret: "y".repeat(40) }, now)).toBe(false);
  });
  it("trocar a senha (hash) derruba sessões antigas", async () => {
    const t = await createSessionToken(ctx, now);
    expect(await verifySessionToken(t, { ...ctx, passwordHash: "scrypt:outro" }, now)).toBe(false);
    expect(passwordFingerprint("a")).not.toBe(passwordFingerprint("b"));
  });
  it("alg none / outro algoritmo é recusado", async () => {
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "admin", iss: "doze-confeitaria", aud: "admin", exp: 9999999999, pwv: passwordFingerprint(ctx.passwordHash) })).toString("base64url")}.`;
    expect(await verifySessionToken(unsigned, ctx, now)).toBe(false);
    const hs512 = await new SignJWT({ pwv: passwordFingerprint(ctx.passwordHash) })
      .setProtectedHeader({ alg: "HS512" }).setIssuer("doze-confeitaria").setAudience("admin").setSubject("admin")
      .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(hs512, ctx, new Date())).toBe(false);
  });
  it("token de outro emissor/audiência é recusado", async () => {
    const other = await new SignJWT({ pwv: passwordFingerprint(ctx.passwordHash) })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("outro").setAudience("admin").setSubject("admin")
      .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(other, ctx, new Date())).toBe(false);
  });
  it("ausente/vazio/lixo => false; segredo curto => não cria token", async () => {
    expect(await verifySessionToken(undefined, ctx, now)).toBe(false);
    expect(await verifySessionToken("", ctx, now)).toBe(false);
    expect(await verifySessionToken("a.b.c", ctx, now)).toBe(false);
    await expect(createSessionToken({ ...ctx, secret: "curto" }, now)).rejects.toThrow();
    expect(await verifySessionToken("a.b.c", { ...ctx, secret: "curto" }, now)).toBe(false);
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
  it("limite global é bem maior que o por IP", () => {
    expect(GLOBAL_FAILURE_THRESHOLD).toBeGreaterThan(IP_FAILURE_THRESHOLD);
    expect(lockoutRemainingMs(fails(10, 0), now, GLOBAL_FAILURE_THRESHOLD)).toBe(0);
    expect(lockoutRemainingMs(fails(GLOBAL_FAILURE_THRESHOLD, 0), now, GLOBAL_FAILURE_THRESHOLD)).toBeGreaterThan(0);
  });
});
