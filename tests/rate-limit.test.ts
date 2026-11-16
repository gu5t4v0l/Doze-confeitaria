import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: number; ip: string; account: string; scope: string; t: number }
let rows: Row[] = [];
let nextId = 1;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db/client", () => {
  const sql = async (strings: TemplateStringsArray, ...v: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("insert into login_attempts")) {
      const r = { id: nextId++, ip: v[0] as string, account: v[1] as string, scope: v[2] as string, t: Date.now() };
      rows.push(r);
      return [{ id: r.id }];
    }
    if (text.includes("delete from login_attempts where id")) {
      rows = rows.filter((r) => r.id !== v[0]);
      return [];
    }
    if (text.includes("delete from login_attempts where scope")) {
      rows = rows.filter((r) => !(r.scope === v[0] && (r.ip === v[1] || r.account === v[2])));
      return [];
    }
    if (text.includes("delete from login_attempts")) return [];
    if (text.includes("select ip_hash, account_hash")) {
      return rows
        .filter((r) => r.scope === v[0] && r.id < (v[1] as number))
        .map((r) => ({ ip_hash: r.ip, account_hash: r.account, t: r.t }));
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

  it("requisições paralelas do mesmo IP: no máximo 5 passam, as demais recebem espera e não ficam gravadas", async () => {
    const { reserveLoginAttempt } = await import("@/lib/auth/rate-limit");
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveLoginAttempt("ip-a", `acc-${i}`)));
    expect(results.filter((w) => w === 0)).toHaveLength(5);
    expect(results.filter((w) => w > 0)).toHaveLength(7);
    expect(rows).toHaveLength(5); // bloqueadas não contam (não disparam bloqueio global)
  });

  it("depois de 5 falhas o 6º é bloqueado; senha correta limpa as falhas do IP e da conta", async () => {
    const { reserveLoginAttempt, clearFailures } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) expect(await reserveLoginAttempt("ip-b", "acc-b")).toBe(0);
    expect(await reserveLoginAttempt("ip-b", "acc-b")).toBeGreaterThan(0);
    await clearFailures("login", "ip-b", "acc-b");
    expect(rows).toHaveLength(0);
    expect(await reserveLoginAttempt("ip-b", "acc-b")).toBe(0);
  });

  it("IPs diferentes não se bloqueiam entre si (abaixo dos limites por conta e global)", async () => {
    const { reserveLoginAttempt } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) await reserveLoginAttempt("ip-c", `acc-c${i}`);
    expect(await reserveLoginAttempt("ip-d", "acc-d")).toBe(0);
  });

  it("limite por conta: 10 falhas de IPs diferentes bloqueiam a conta com espera curta (<= 5 min)", async () => {
    const { reserveLoginAttempt } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 10; i++) expect(await reserveLoginAttempt(`ip-x${i}`, "acc-alvo")).toBe(0);
    const wait = await reserveLoginAttempt("ip-novo", "acc-alvo");
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(5 * 60_000);
    // outra conta, outro IP: livre
    expect(await reserveLoginAttempt("ip-outro", "acc-outra")).toBe(0);
    // tentativas bloqueadas não foram gravadas: a espera não é prolongada pelo atacante
    expect(rows.filter((r) => r.account === "acc-alvo")).toHaveLength(10);
  });

  it("troca de senha tem escopo próprio: não conta no login e vice-versa", async () => {
    const { reserveLoginAttempt, reservePasswordAttempt } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) expect(await reservePasswordAttempt("ip-e", "user-1")).toBe(0);
    expect(await reservePasswordAttempt("ip-e", "user-1")).toBeGreaterThan(0);
    expect(await reserveLoginAttempt("ip-e", "acc-e")).toBe(0);
  });
});

describe("hash de IP e de e-mail", () => {
  it("IP: determinístico, depende do segredo e não é o SHA simples do segredo/JWT", async () => {
    const { hashIp } = await import("@/lib/auth/rate-limit");
    const a = hashIp("1.2.3.4", "s".repeat(40));
    expect(a).toBe(hashIp("1.2.3.4", "s".repeat(40)));
    expect(a).not.toBe(hashIp("1.2.3.4", "t".repeat(40)));
    expect(a).not.toBe(hashIp("1.2.3.5", "s".repeat(40)));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it("e-mail: normaliza, usa rótulo próprio e não vaza o texto", async () => {
    const { hashEmail } = await import("@/lib/auth/email");
    const { hashIp } = await import("@/lib/auth/rate-limit");
    const h = hashEmail("  Maria@Exemplo.COM ", "s".repeat(40));
    expect(h).toBe(hashEmail("maria@exemplo.com", "s".repeat(40)));
    expect(h).not.toContain("maria");
    expect(h).not.toBe(hashIp("maria@exemplo.com", "s".repeat(40))); // rótulos distintos
  });
});
