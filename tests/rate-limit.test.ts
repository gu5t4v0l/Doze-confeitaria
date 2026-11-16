import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: number; ip: string; t: number }
let rows: Row[] = [];
let nextId = 1;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db/client", () => {
  const sql = async (strings: TemplateStringsArray, ...v: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("insert into login_attempts")) {
      const r = { id: nextId++, ip: v[0] as string, t: Date.now() };
      rows.push(r);
      return [{ id: r.id }];
    }
    if (text.includes("delete from login_attempts where id")) {
      rows = rows.filter((r) => r.id !== v[0]);
      return [];
    }
    if (text.includes("delete from login_attempts where ip_hash")) {
      rows = rows.filter((r) => r.ip !== v[0]);
      return [];
    }
    if (text.includes("delete from login_attempts")) return [];
    if (text.includes("select (extract")) {
      const byIp = text.includes("ip_hash =");
      return rows
        .filter((r) => r.id < (v[v.length - 2] as number) && (!byIp || r.ip === v[0]))
        .map((r) => ({ t: r.t }));
    }
    return [];
  };
  return { getDb: () => sql };
});

describe("limite de login (reserva antes do scrypt)", () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
  });

  it("requisições paralelas: no máximo 5 passam, as demais recebem espera e não ficam gravadas", async () => {
    const { reserveLoginAttempt } = await import("@/lib/auth/rate-limit");
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveLoginAttempt("ip-a")));
    expect(results.filter((w) => w === 0)).toHaveLength(5);
    expect(results.filter((w) => w > 0)).toHaveLength(7);
    expect(rows).toHaveLength(5); // bloqueadas não contam (não disparam bloqueio global)
  });

  it("depois de 5 falhas o 6º é bloqueado; senha correta limpa as falhas do IP", async () => {
    const { reserveLoginAttempt, clearFailures } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) expect(await reserveLoginAttempt("ip-b")).toBe(0);
    expect(await reserveLoginAttempt("ip-b")).toBeGreaterThan(0);
    await clearFailures("ip-b");
    expect(rows).toHaveLength(0);
    expect(await reserveLoginAttempt("ip-b")).toBe(0);
  });

  it("IPs diferentes não se bloqueiam entre si (abaixo do limite global)", async () => {
    const { reserveLoginAttempt } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) await reserveLoginAttempt("ip-c");
    expect(await reserveLoginAttempt("ip-d")).toBe(0);
  });
});

describe("hash de IP", () => {
  it("é determinístico, depende do segredo e não é o SHA simples do segredo/JWT", async () => {
    const { hashIp } = await import("@/lib/auth/rate-limit");
    const a = hashIp("1.2.3.4", "s".repeat(40));
    expect(a).toBe(hashIp("1.2.3.4", "s".repeat(40)));
    expect(a).not.toBe(hashIp("1.2.3.4", "t".repeat(40)));
    expect(a).not.toBe(hashIp("1.2.3.5", "s".repeat(40)));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});
