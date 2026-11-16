// Uso: npm run admin:create            (pergunta e-mail, nome e senha; a senha é digitada OCULTA, com confirmação)
//      npm run admin:create -- --generate   (gera uma senha forte aleatória e a mostra UMA única vez)
// Lê DATABASE_URL de .env.local. Nenhuma senha passa por argv nem é gravada em arquivo/log.
import { hashPassword } from "../src/lib/auth/password";
import { validateNewPassword } from "../src/lib/auth/password-policy";
import { isValidEmail, normalizeEmail } from "../src/lib/auth/email";
import { createUser } from "../src/lib/auth/users";
import { recordAudit } from "../src/lib/auth/audit";
import { askHidden, askVisible, generatePassword } from "./lib/prompt";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente. Rode via `npm run admin:create`.");
  const generate = process.argv.includes("--generate");

  const email = normalizeEmail(await askVisible("E-mail de acesso: "));
  if (!isValidEmail(email)) throw new Error("E-mail inválido.");
  const displayName = await askVisible("Nome (opcional): ");

  let password: string;
  if (generate) {
    password = generatePassword();
  } else {
    password = await askHidden("Senha (12 a 128 caracteres; use uma frase longa): ");
    const again = await askHidden("Repita a senha: ");
    if (password !== again) throw new Error("As senhas não conferem.");
  }
  const policy = validateNewPassword(password, { email });
  if (!policy.ok) throw new Error(policy.error);

  const user = await createUser(email, displayName, await hashPassword(password));
  if (!user) throw new Error("Já existe um usuário com esse e-mail. Para trocar a senha use `npm run admin:reset`.");
  await recordAudit({ event: "user_created", userId: user.id });

  console.log(`\nAdmin criado: ${user.email}`);
  if (generate) {
    console.log("\nSENHA (guarde agora; ela não será mostrada de novo):\n");
    console.log(`  ${password}\n`);
    console.log("Depois de entrar, troque-a em /admin/conta.");
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`\nErro: ${e instanceof Error ? e.message : "falha desconhecida"}`);
    process.exit(1);
  },
);
