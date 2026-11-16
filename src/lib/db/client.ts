import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null = null;

/** Conexão preguiçosa: nada acontece (nem quebra o build) até a primeira consulta. */
export function getDb(): Sql {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    cached = neon(url);
  }
  return cached;
}
