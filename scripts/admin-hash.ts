// Uso:
//   npm run admin:hash            gera uma senha forte aleatória
//   npm run admin:hash -- --stdin lê a senha da entrada padrão (1 linha)
// Imprime o hash (para ADMIN_PASSWORD_HASH), um SESSION_SECRET novo e a senha.
// A senha aparece UMA vez, só no terminal; nada é gravado em arquivo.
import { randomBytes, randomInt } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

// sem 0/O/1/l/I para evitar confusão ao digitar no celular
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  );
  return groups.join("-");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "";
}

async function main() {
  const fromStdin = process.argv.includes("--stdin");
  const password = fromStdin ? await readStdin() : generatePassword();
  if (fromStdin && password.length < 10) {
    console.error("A senha precisa ter pelo menos 10 caracteres.");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  console.log("\nCopie estas linhas para o ambiente (Vercel: `vercel env add NOME production`):\n");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
  if (!fromStdin) {
    console.log("\nSENHA do painel (guarde agora, ela não será mostrada de novo):\n");
    console.log(`  ${password}\n`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
