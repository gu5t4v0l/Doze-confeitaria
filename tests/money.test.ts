import { describe, it, expect } from "vitest";
import { centsToInput, MAX_PRICE_CENTS, parseMoneyToCents } from "@/lib/money";

describe("parseMoneyToCents (vírgula decimal pt-BR)", () => {
  it.each([
    ["19", 1900],
    ["19,5", 1950],
    ["19,50", 1950],
    ["19,05", 1905],
    ["0,99", 99],
    ["0", 0],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["R$ 49,90", 4990],
    ["  7 ", 700],
    ["10000", 1_000_000],
  ])("%s -> %s", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));

  it.each(["", " ", "abc", "-5", "1,234", "19,", ",5", "1..2", "12.34", "1,2,3", "1e3", "NaN", "9".repeat(30)])(
    "rejeita %j",
    (input) => expect(parseMoneyToCents(input)).toBeNull(),
  );

  it("não passa por ponto flutuante (19,9 vira exatamente 1990)", () => {
    expect(parseMoneyToCents("19,9")).toBe(1990);
    expect(parseMoneyToCents("0,29")).toBe(29);
    expect(parseMoneyToCents("1,15")).toBe(115);
  });
  it("limite de preço", () => {
    expect(MAX_PRICE_CENTS).toBe(1_000_000);
  });
});

describe("centsToInput", () => {
  it.each([
    [1900, "19,00"],
    [1950, "19,50"],
    [5, "0,05"],
    [0, "0,00"],
    [123456, "1234,56"],
  ])("%s -> %s", (c, s) => expect(centsToInput(c)).toBe(s));
  it("ida e volta", () => {
    for (const c of [0, 1, 99, 100, 1905, 999_999, 1_000_000]) {
      expect(parseMoneyToCents(centsToInput(c))).toBe(c);
    }
  });
});
