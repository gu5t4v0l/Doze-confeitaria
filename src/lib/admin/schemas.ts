import { z } from "zod";
import { isAllowedBlobUrl } from "@/lib/blob-url";
import { isValidISODate } from "@/lib/dates";
import { MAX_PRICE_CENTS } from "@/lib/money";
import {
  MAX_PAYMENT_NOTE_LENGTH,
  MAX_PIX_HOLDER_LENGTH,
  MAX_PIX_KEY_LENGTH,
  PIX_KEY_TYPES,
  normalizePixKey,
  stripControl,
} from "@/lib/payment";

/** Textos aparados e com tamanho máximo; sem caracteres de controle. */
const noControl = (s: string) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s);
const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} inválido.` })
    .trim()
    .min(min, min > 0 ? `Preencha: ${label}.` : undefined)
    .max(max, `${label}: no máximo ${max} caracteres.`)
    .refine(noControl, `${label} contém caracteres inválidos.`);

const id = z.number().int().positive().max(2_000_000_000);
const priceCents = z
  .number({ error: "Informe um preço válido." })
  .int("Informe um preço válido.")
  .min(0, "O preço não pode ser negativo.")
  .max(MAX_PRICE_CENTS, "Preço alto demais (máximo R$ 10.000,00).");

export const optionSchema = z.object({
  id: id.optional(),
  label: text(1, 80, "Nome da opção"),
  priceCents,
});

export const itemSchema = z
  .object({
    id: id.optional(),
    categoryId: id,
    name: text(1, 80, "Nome"),
    description: text(0, 300, "Descrição"),
    priceCents,
    glutenFree: z.boolean(),
    imageUrl: z
      .string()
      .max(500)
      .refine((v) => isAllowedBlobUrl(v), "Foto inválida. Envie a foto de novo.")
      .nullable(),
    options: z.array(optionSchema).max(20, "No máximo 20 opções."),
  })
  .refine((v) => v.options.length === 0 || v.options.length >= 2, {
    message: "Para ter opções, informe pelo menos duas (ou remova todas).",
    path: ["options"],
  });
export type ItemInput = z.infer<typeof itemSchema>;

export const categorySchema = z.object({
  id: id.optional(),
  name: text(1, 40, "Nome da categoria"),
  note: text(0, 80, "Observação"),
  emoji: text(0, 8, "Emoji"),
});
export type CategoryInput = z.infer<typeof categorySchema>;

const isoDateOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidISODate(v), "Data inválida.");

/** Aceita "(11) 91145-4427", "+55 11 91145-4427"...; guarda só dígitos com DDI 55. */
export function normalizeWhatsapp(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("+") && !/^\+\s*55/.test(trimmed)) return null; // só Brasil (DDI 55)
  let digits = input.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : null;
}

/** Texto opcional de uma linha: remove caracteres de controle e limita o tamanho. */
const cleanText = (max: number, label: string) =>
  z
    .string({ error: `${label} inválido.` })
    .max(max * 4, `${label}: no máximo ${max} caracteres.`)
    .transform(stripControl)
    .pipe(z.string().max(max, `${label}: no máximo ${max} caracteres.`));

const depositPercent = z
  .number({ error: "Sinal: informe um número entre 0 e 100." })
  .int("Sinal: informe um número inteiro entre 0 e 100.")
  .min(0, "Sinal: o mínimo é 0%.")
  .max(100, "Sinal: o máximo é 100%.");

const PIX_KEY_ERROR = {
  cpf: "A chave Pix não parece um CPF: use 11 números.",
  cnpj: "A chave Pix não parece um CNPJ: use 14 números.",
  email: "A chave Pix não parece um e-mail válido.",
  telefone: "A chave Pix não parece um telefone: use DDD + número (+55).",
  aleatoria: "A chave aleatória deve ter 32 a 36 caracteres (letras a-f e números, com ou sem hífens).",
} as const;

export const settingsSchema = z
  .object({
    whatsappNumber: z
      .string()
      .max(30)
      .transform((v, ctx) => {
        const n = normalizeWhatsapp(v);
        if (!n) {
          ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número, ex.: (11) 91145-4427." });
          return z.NEVER;
        }
        return n;
      }),
    orderDeadline: isoDateOrEmpty,
    lastDeliveryDate: isoDateOrEmpty,
    minLeadDays: z.number().int("Informe um número inteiro.").min(0).max(60, "No máximo 60 dias."),
    noticeLines: z
      .array(text(1, 200, "Aviso"))
      .max(8, "No máximo 8 avisos."),
    depositPercent,
    pixKeyType: z.enum([...PIX_KEY_TYPES, ""], { error: "Tipo de chave Pix inválido." }),
    pixKey: cleanText(MAX_PIX_KEY_LENGTH, "Chave Pix"),
    pixHolder: cleanText(MAX_PIX_HOLDER_LENGTH, "Nome do favorecido"),
    paymentNote: cleanText(MAX_PAYMENT_NOTE_LENGTH, "Observação de pagamento"),
  })
  .transform((v, ctx) => {
    if (v.pixKey === "") return { ...v, pixKeyType: "" as const };
    if (v.pixKeyType === "") {
      ctx.addIssue({ code: "custom", message: "Escolha o tipo da chave Pix.", path: ["pixKeyType"] });
      return z.NEVER;
    }
    const key = normalizePixKey(v.pixKeyType, v.pixKey);
    if (!key) {
      ctx.addIssue({ code: "custom", message: PIX_KEY_ERROR[v.pixKeyType], path: ["pixKey"] });
      return z.NEVER;
    }
    return { ...v, pixKey: key };
  })
  .refine(
    (v) => !v.orderDeadline || !v.lastDeliveryDate || v.lastDeliveryDate >= v.orderDeadline,
    { message: "A data de entrega não pode ser antes da data limite de pedidos.", path: ["lastDeliveryDate"] },
  );
export type SettingsInput = z.infer<typeof settingsSchema>;

export const idSchema = id;
export const directionSchema = z.enum(["up", "down"]);

/** Primeira mensagem de erro (pt-BR) de um resultado do zod. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
