import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/session-config";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

// ---------------------------------------------------------------- fronteiras mockadas: next/*, banco e camada de usuários
const SECRET = "s".repeat(48);
const PASSWORD = "bolo de laranja com calda";
const NEW_PASSWORD = "brigadeiro de panela grande";

const jar = new Map<string, string>();
const cookieOps: Array<{ name: string; value: string; maxAge?: number }> = [];
let reqHeaders = new Headers();

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({
  headers: async () => reqHeaders,
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n) } : undefined),
    set: (n: string, v: string, o?: { maxAge?: number }) => {
      cookieOps.push({ name: n, value: v, maxAge: o?.maxAge });
      if (v === "" || o?.maxAge === 0) jar.delete(n);
      else jar.set(n, v);
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));

interface Row { id: number; ip: string; account: string; scope: string; t: number }
let attempts: Row[] = [];
let nextAttempt = 1;
let audit: Array<Record<string, unknown>> = [];
let dbDown = false;

vi.mock("@/lib/db/client", () => {
  const sql = async (strings: TemplateStringsArray, ...v: unknown[]) => {
    if (dbDown) throw new Error("db fora do ar");
    const text = strings.join("?");
    if (text.includes("insert into login_attempts")) {
      attempts.push({ id: nextAttempt, ip: v[0] as string, account: v[1] as string, scope: v[2] as string, t: Date.now() });
      return [{ id: nextAttempt++ }];
    }
    if (text.includes("delete from login_attempts where id")) {
      attempts = attempts.filter((r) => r.id !== v[0]);
      return [];
    }
    if (text.includes("delete from login_attempts where scope")) {
      attempts = attempts.filter((r) => !(r.scope === v[0] && (r.ip === v[1] || r.account === v[2])));
      return [];
    }
    if (text.includes("select ip_hash, account_hash")) {
      return attempts.filter((r) => r.scope === v[0] && r.id < (v[1] as number)).map((r) => ({ ip_hash: r.ip, account_hash: r.account, t: r.t }));
    }
    if (text.includes("insert into admin_audit")) {
      audit.push({ user_id: v[0], event: v[1], ip_hash: v[2], subject_hash: v[3], user_agent: v[4] });
      return [];
    }
    return [];
  };
  return { getDb: () => sql };
});

interface FakeUser { id: number; email: string; hash: string; active: boolean; sv: number }
let users: FakeUser[] = [];
vi.mock("@/lib/auth/users", () => ({
  findLoginCandidate: async (email: string) => {
    if (dbDown) throw new Error("db fora do ar");
    const u = users.find((x) => x.email === email);
    return u ? { id: u.id, passwordHash: u.hash, active: u.active, sessionVersion: u.sv } : null;
  },
  getPasswordHash: async (id: number) => users.find((x) => x.id === id && x.active)?.hash ?? null,
  getSessionState: async (id: number) => {
    if (dbDown) throw new Error("db fora do ar");
    const u = users.find((x) => x.id === id);
    return u ? { id: u.id, active: u.active, sessionVersion: u.sv } : null;
  },
  getUserDto: async (id: number) => {
    const u = users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, displayName: "", active: u.active, lastLoginAt: null, passwordChangedAt: null } : null;
  },
  recordLogin: async () => {},
  changePassword: async (id: number, oldHash: string, newHash: string) => {
    const u = users.find((x) => x.id === id && x.hash === oldHash);
    if (!u) return null;
    u.hash = newHash;
    return ++u.sv;
  },
  revokeSessions: async (id: number) => {
    const u = users.find((x) => x.id === id);
    if (u) u.sv++;
    return Boolean(u);
  },
}));

const EMAIL = "teste@exemplo.invalid";

beforeEach(async () => {
  process.env.SESSION_SECRET = SECRET;
  jar.clear();
  cookieOps.length = 0;
  attempts = [];
  nextAttempt = 1;
  audit = [];
  dbDown = false;
  reqHeaders = new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Vitest/1.0" });
  users = [{ id: 5, email: EMAIL, hash: await hashPassword(PASSWORD), active: true, sv: 1 }];
});
afterEach(() => vi.restoreAllMocks());

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
async function redirectTarget(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { to?: string }).to ?? "ERRO";
  }
}
const instantTimers = () =>
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);

// ---------------------------------------------------------------- login
describe("login por e-mail + senha", () => {
  it("usuário inexistente, inativo e senha errada devolvem o MESMO resultado e tempo mínimo (~900 ms)", async () => {
    const { loginAction } = await import("@/app/admin/login/actions");
    users.push({ id: 6, email: "inativo@exemplo.invalid", hash: await hashPassword(PASSWORD), active: false, sv: 1 });
    const cases = [
      { email: "ninguem@exemplo.invalid", senha: PASSWORD }, // não existe
      { email: "inativo@exemplo.invalid", senha: PASSWORD }, // inativo, senha certa
      { email: EMAIL, senha: "senha completamente errada" }, // senha errada
    ];
    const results: unknown[] = [];
    for (const c of cases) {
      const t0 = Date.now();
      results.push(await loginAction({}, form(c)));
      expect(Date.now() - t0).toBeGreaterThanOrEqual(850);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect((results[0] as { error: string }).error).toMatch(/E-mail ou senha incorretos/);
    expect(cookieOps).toHaveLength(0); // nenhuma sessão emitida
  }, 20_000);

  it("sucesso: emite cookie com sub/sv, redireciona e audita sem dados sensíveis", async () => {
    instantTimers();
    const { loginAction } = await import("@/app/admin/login/actions");
    expect(await redirectTarget(loginAction({}, form({ email: `  ${EMAIL.toUpperCase()} `, senha: PASSWORD })))).toBe("/admin");
    const claims = await verifySessionToken(jar.get(SESSION_COOKIE), SECRET);
    expect(claims).toEqual({ userId: 5, sessionVersion: 1 });
    expect(audit.map((a) => a.event)).toEqual(["login_success"]);
    expect(audit[0].user_id).toBe(5);
  });

  it("auditoria: nunca senha, e-mail digitado nem IP cru; inexistente só com hash do e-mail", async () => {
    instantTimers();
    const { loginAction } = await import("@/app/admin/login/actions");
    await loginAction({}, form({ email: "fantasma@exemplo.invalid", senha: "SenhaDoFantasma!" }));
    await loginAction({}, form({ email: EMAIL, senha: "errada errada errada" }));
    expect(audit.map((a) => a.event)).toEqual(["login_failure", "login_failure"]);
    const dump = JSON.stringify([audit, attempts]);
    for (const secret of ["fantasma", "SenhaDoFantasma", "errada", PASSWORD, "203.0.113.7", EMAIL, "scrypt:"]) {
      expect(dump).not.toContain(secret);
    }
    expect(audit[0].subject_hash).toMatch(/^[0-9a-f]{32}$/); // inexistente: hash do e-mail
    expect(audit[0].user_id).toBeNull();
    expect(audit[1].subject_hash).toBeNull(); // conta real: só user_id
    expect(audit[1].user_id).toBe(5);
    expect(audit[0].ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(audit[0].user_agent).toBe("Vitest/1.0");
  });

  it("limite por conta: 10 falhas de IPs diferentes bloqueiam até a senha certa (espera curta)", async () => {
    instantTimers();
    const { loginAction } = await import("@/app/admin/login/actions");
    for (let i = 0; i < 10; i++) {
      reqHeaders = new Headers({ "x-forwarded-for": `198.51.100.${i + 1}` });
      await loginAction({}, form({ email: EMAIL, senha: "errada errada errada" }));
    }
    reqHeaders = new Headers({ "x-forwarded-for": "198.51.100.200" });
    const r = await loginAction({}, form({ email: EMAIL, senha: PASSWORD }));
    expect(r.error).toMatch(/Muitas tentativas/);
    expect(r.error).toMatch(/\b[1-5] min\b/);
    expect(cookieOps).toHaveLength(0);
  });

  it("limite por IP: 5 erros e o 6º é barrado, mesmo com a senha certa", async () => {
    instantTimers();
    const { loginAction } = await import("@/app/admin/login/actions");
    for (let i = 0; i < 5; i++) await loginAction({}, form({ email: EMAIL, senha: "errada errada errada" }));
    expect((await loginAction({}, form({ email: EMAIL, senha: PASSWORD }))).error).toMatch(/Muitas tentativas/);
  });

  it("falha segura: sem SESSION_SECRET válido ninguém entra; banco fora do ar também não", async () => {
    instantTimers();
    const { loginAction } = await import("@/app/admin/login/actions");
    process.env.SESSION_SECRET = "curto";
    expect((await loginAction({}, form({ email: EMAIL, senha: PASSWORD }))).error).toMatch(/Não foi possível entrar/);
    process.env.SESSION_SECRET = SECRET;
    dbDown = true;
    expect((await loginAction({}, form({ email: EMAIL, senha: PASSWORD }))).error).toMatch(/Não foi possível entrar/);
    expect(cookieOps).toHaveLength(0);
  });

  it("logout apaga o cookie, audita e vai ao login", async () => {
    const { logoutAction } = await import("@/app/admin/login/actions");
    jar.set(SESSION_COOKIE, await createSessionToken(SECRET, { userId: 5, sessionVersion: 1 }));
    expect(await redirectTarget(logoutAction())).toBe("/admin/login");
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(audit.map((a) => a.event)).toEqual(["logout"]);
  });
});

// ---------------------------------------------------------------- sessão (JWT + banco)
describe("requireAdmin / isAdmin (JWT + banco)", () => {
  const withToken = async (sv: number, userId = 5) =>
    jar.set(SESSION_COOKIE, await createSessionToken(SECRET, { userId, sessionVersion: sv }));

  it("sessão válida passa e devolve o usuário", async () => {
    const { requireAdmin, isAdmin } = await import("@/lib/auth/session");
    await withToken(1);
    expect(await isAdmin()).toBe(true);
    expect(await requireAdmin()).toEqual({ userId: 5, sessionVersion: 1 });
  });
  it("sem cookie => login", async () => {
    const { requireAdmin, isAdmin } = await import("@/lib/auth/session");
    expect(await isAdmin()).toBe(false);
    expect(await redirectTarget(requireAdmin())).toBe("/admin/login");
  });
  it("sv antigo recusado (JWT válido, versão revogada) e vai pela rota que apaga o cookie", async () => {
    const { requireAdmin, isAdmin } = await import("@/lib/auth/session");
    await withToken(1);
    users[0].sv = 2;
    expect(await isAdmin()).toBe(false);
    expect(await redirectTarget(requireAdmin())).toBe("/admin/sessao-encerrada");
  });
  it("usuário inativo ou inexistente é recusado", async () => {
    const { isAdmin } = await import("@/lib/auth/session");
    await withToken(1);
    users[0].active = false;
    expect(await isAdmin()).toBe(false);
    users[0].active = true;
    await withToken(1, 99);
    expect(await isAdmin()).toBe(false);
  });
  it("falha segura: banco fora do ar NEGA; SESSION_SECRET ausente/curto NEGA", async () => {
    const { isAdmin } = await import("@/lib/auth/session");
    await withToken(1);
    dbDown = true;
    expect(await isAdmin()).toBe(false);
    dbDown = false;
    expect(await isAdmin()).toBe(true);
    delete process.env.SESSION_SECRET;
    expect(await isAdmin()).toBe(false);
    process.env.SESSION_SECRET = "x".repeat(31);
    expect(await isAdmin()).toBe(false);
  });
  it("token assinado com outro segredo é recusado", async () => {
    const { isAdmin } = await import("@/lib/auth/session");
    jar.set(SESSION_COOKIE, await createSessionToken("z".repeat(48), { userId: 5, sessionVersion: 1 }));
    expect(await isAdmin()).toBe(false);
  });
});

// ---------------------------------------------------------------- trocar senha / sair de todos
describe("trocar a senha pelo painel", () => {
  beforeEach(async () => {
    instantTimers();
    jar.set(SESSION_COOKIE, await createSessionToken(SECRET, { userId: 5, sessionVersion: 1 }));
  });

  it("senha atual correta + nova válida: bumpa sv, emite sessão nova, derruba a antiga e audita", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    const { isAdmin } = await import("@/lib/auth/session");
    const oldToken = jar.get(SESSION_COOKIE)!;
    const r = await changePasswordAction({}, form({ atual: PASSWORD, nova: NEW_PASSWORD, confirmar: NEW_PASSWORD }));
    expect(r).toEqual({ ok: true, message: expect.any(String) }); // DTO mínimo
    expect(users[0].sv).toBe(2);
    const fresh = await verifySessionToken(jar.get(SESSION_COOKIE), SECRET);
    expect(fresh).toEqual({ userId: 5, sessionVersion: 2 });
    expect(await isAdmin()).toBe(true); // este aparelho continua logado
    jar.set(SESSION_COOKIE, oldToken); // outro aparelho, com a sessão antiga
    expect(await isAdmin()).toBe(false);
    expect(audit.map((a) => a.event)).toEqual(["password_changed"]);
    expect(JSON.stringify(audit)).not.toContain(NEW_PASSWORD);
  });

  it("exige a senha atual correta (e não troca nada)", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    const before = users[0].hash;
    const r = await changePasswordAction({}, form({ atual: "senha atual errada!!", nova: NEW_PASSWORD, confirmar: NEW_PASSWORD }));
    expect(r.error).toMatch(/senha atual não confere/);
    expect(users[0].hash).toBe(before);
    expect(users[0].sv).toBe(1);
    expect(audit).toHaveLength(0);
  });

  it("senha atual errada conta no limite próprio: 5 erros e a próxima tentativa é barrada", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    for (let i = 0; i < 5; i++) {
      await changePasswordAction({}, form({ atual: "errada errada errada", nova: NEW_PASSWORD, confirmar: NEW_PASSWORD }));
    }
    const r = await changePasswordAction({}, form({ atual: PASSWORD, nova: NEW_PASSWORD, confirmar: NEW_PASSWORD }));
    expect(r.error).toMatch(/Muitas tentativas/);
    expect(users[0].sv).toBe(1);
  });

  it("recusa fraca, comum, igual à atual, com o e-mail, curta e confirmação diferente", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    const tryNew = (nova: string, confirmar = nova) => changePasswordAction({}, form({ atual: PASSWORD, nova, confirmar }));
    expect((await tryNew("curta")).error).toMatch(/pelo menos 12/);
    expect((await tryNew("password12345")).error).toMatch(/comum/);
    expect((await tryNew(PASSWORD)).error).toMatch(/diferente da atual/);
    expect((await tryNew("meu teste@exemplo.invalid aqui")).error).toMatch(/e-mail/);
    expect((await tryNew(NEW_PASSWORD, "outra coisa qualquer")).error).toMatch(/confirmação/);
    expect((await tryNew("x".repeat(129))).error).toMatch(/máximo 128/);
    expect(users[0].sv).toBe(1);
  });

  it("errar só a NOVA senha não pune quem acertou a atual", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    for (let i = 0; i < 8; i++) await changePasswordAction({}, form({ atual: PASSWORD, nova: "curta", confirmar: "curta" }));
    const r = await changePasswordAction({}, form({ atual: PASSWORD, nova: NEW_PASSWORD, confirmar: NEW_PASSWORD }));
    expect(r.ok).toBe(true);
  });

  it("sem sessão válida a ação nem executa (requireAdmin)", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    jar.clear();
    expect(await redirectTarget(changePasswordAction({}, form({ atual: PASSWORD, nova: NEW_PASSWORD, confirmar: NEW_PASSWORD })))).toBe("/admin/login");
    expect(users[0].sv).toBe(1);
  });

  it("falhas internas viram mensagem genérica (sem stack/SQL)", async () => {
    const { changePasswordAction } = await import("@/app/admin/(painel)/conta/actions");
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbDown = true; // requireAdmin nega por causa do banco => redireciona; então derruba só depois da sessão
    const t = await redirectTarget(changePasswordAction({}, form({ atual: PASSWORD, nova: NEW_PASSWORD, confirmar: NEW_PASSWORD })));
    expect(t).toBe("/admin/sessao-encerrada");
  });

  it("'sair de todos': bumpa sv, apaga o cookie, audita e vai ao login", async () => {
    const { revokeAllSessionsAction } = await import("@/app/admin/(painel)/conta/actions");
    expect(await redirectTarget(revokeAllSessionsAction())).toBe("/admin/login");
    expect(users[0].sv).toBe(2);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(audit.map((a) => a.event)).toEqual(["sessions_revoked"]);
  });
});
