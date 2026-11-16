// Uso: npm run db:migrate  (lê DATABASE_URL de .env.local)
import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente. Rode via `npm run db:migrate`.");
  process.exit(1);
}
const sql = neon(url);

async function main() {
  for (const statement of schemaStatements) {
    await sql.query(statement);
  }
  console.log(`Migração concluída (${schemaStatements.length} instruções).`);

}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
