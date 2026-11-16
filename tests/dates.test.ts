import { describe, it, expect, afterEach } from "vitest";
import {
  addDaysISO,
  getDateBounds,
  isOrdersClosed,
  isValidISODate,
  parseISODate,
  todayInSaoPaulo,
  validateDesiredDate,
  type OrderRules,
} from "@/lib/dates";

/** Regras como vêm do banco (nada de 2026 fixo no código). */
const rules: OrderRules = { orderDeadline: "2026-12-19", lastDeliveryDate: "2026-12-24", minLeadDays: 3 };

const zones = ["America/Sao_Paulo", "UTC", "Pacific/Auckland", "America/Los_Angeles"];
const origTZ = process.env.TZ;
afterEach(() => {
  if (origTZ === undefined) delete process.env.TZ;
  else process.env.TZ = origTZ;
});

describe("parseISODate / isValidISODate", () => {
  it("parse estrito", () => {
    expect(parseISODate("2026-12-24")).toEqual({ y: 2026, m: 12, d: 24 });
    for (const bad of ["", "2026-13-01", "2026-02-30", "2026-2-3", "26-12-24", "2026-12-24T00:00", " 2026-12-24", "abcd-ef-gh", "2026-00-10", "2026-12-00"]) {
      expect(isValidISODate(bad), bad).toBe(false);
    }
  });
  it("29/02 só em ano bissexto", () => {
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
  });
});

describe("addDaysISO", () => {
  it("cruza mês e ano", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysISO("2026-02-27", 3)).toBe("2026-03-02");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("não depende de horário de verão", () => {
    for (const d of ["2026-03-07", "2026-04-04", "2026-10-03", "2026-11-01"]) {
      expect(addDaysISO(addDaysISO(d, 3), -3)).toBe(d);
    }
  });
  it("lança em data inválida", () => {
    expect(() => addDaysISO("2026-02-30", 1)).toThrow();
  });
});

describe("todayInSaoPaulo", () => {
  it("usa o dia de São Paulo (UTC-3), não o do servidor/aparelho", () => {
    expect(todayInSaoPaulo(new Date("2026-12-24T02:59:59Z"))).toBe("2026-12-23");
    expect(todayInSaoPaulo(new Date("2026-12-24T03:00:00Z"))).toBe("2026-12-24");
    expect(todayInSaoPaulo(new Date("2026-12-25T02:30:00Z"))).toBe("2026-12-24");
  });
  it.each(zones)("resultado idêntico com TZ=%s", (tz) => {
    process.env.TZ = tz;
    expect(todayInSaoPaulo(new Date("2026-11-15T01:00:00Z"))).toBe("2026-11-14");
    expect(todayInSaoPaulo(new Date("2026-11-15T12:00:00Z"))).toBe("2026-11-15");
  });
});

describe("isOrdersClosed (data limite vinda do banco)", () => {
  it("aberto até o próprio dia limite; fecha no dia seguinte", () => {
    expect(isOrdersClosed("2026-12-18", rules)).toBe(false);
    expect(isOrdersClosed("2026-12-19", rules)).toBe(false);
    expect(isOrdersClosed("2026-12-20", rules)).toBe(true);
  });
  it("sem data limite nunca encerra", () => {
    expect(isOrdersClosed("2099-01-01", { ...rules, orderDeadline: null })).toBe(false);
  });
  it("funciona para outro ano (sem hardcode de 2026)", () => {
    const next: OrderRules = { orderDeadline: "2027-12-19", lastDeliveryDate: "2027-12-24", minLeadDays: 3 };
    expect(isOrdersClosed("2027-12-20", next)).toBe(true);
    expect(isOrdersClosed("2026-12-20", next)).toBe(false);
  });
});

describe("limites e validação da data desejada", () => {
  it("mínimo = hoje + antecedência e máximo = última entrega", () => {
    expect(getDateBounds("2026-11-15", rules)).toEqual({ min: "2026-11-18", max: "2026-12-24" });
    expect(getDateBounds("2026-11-15", { ...rules, minLeadDays: 5, lastDeliveryDate: null })).toEqual({
      min: "2026-11-20",
      max: null,
    });
  });

  it("bordas de validade", () => {
    const today = "2026-11-15";
    expect(validateDesiredDate("2026-11-17", today, rules)).toMatch(/Prazo mínimo de 3 dias.*18\/11\/2026/);
    expect(validateDesiredDate("2026-11-18", today, rules)).toBeNull();
    expect(validateDesiredDate("2026-12-24", today, rules)).toBeNull();
    expect(validateDesiredDate("2026-12-25", today, rules)).toMatch(/somente até 24\/12\/2026/);
    expect(validateDesiredDate("2026-11-15", today, rules)).not.toBeNull();
    expect(validateDesiredDate("", today, rules)).toBeNull();
    expect(validateDesiredDate("2026-02-30", today, rules)).toBe("Informe uma data válida.");
    expect(validateDesiredDate("lixo", today, rules)).toBe("Informe uma data válida.");
  });

  it("sem última entrega, qualquer data após o mínimo vale", () => {
    expect(validateDesiredDate("2030-01-01", "2026-11-15", { ...rules, lastDeliveryDate: null })).toBeNull();
  });

  it("período encerrado quando hoje+antecedência passa da última entrega", () => {
    expect(validateDesiredDate("2026-12-24", "2026-12-22", rules)).toMatch(/período de encomendas terminou/);
    expect(validateDesiredDate("2026-12-24", "2026-12-21", rules)).toBeNull();
  });

  it.each(zones)("mesmo resultado em TZ=%s (aritmética de datas sem fuso)", (tz) => {
    process.env.TZ = tz;
    expect(getDateBounds("2026-11-15", rules).min).toBe("2026-11-18");
    expect(validateDesiredDate("2026-11-18", "2026-11-15", rules)).toBeNull();
  });
});
