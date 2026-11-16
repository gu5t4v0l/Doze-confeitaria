// Uso: npm run admin:reset             (pergunta o e-mail e a nova senha OCULTA, com confirmação)
//      npm run admin:reset -- --generate   (gera uma senha forte e a mostra UMA única vez)
// Redefine a senha de um admin EXISTENTE, derruba todas as sessões (session_version + 1),
// limpa os bloqueios de login daquela conta e grava `password_reset_cli` na auditoria.
import { hashPassword } from "../src/lib/auth/password";
import { validateNewPassword } from "../src/lib/auth/password-policy";
import { isValidEmail, normalizeEmail } from "../src/lib/auth/email";
import { resetPassword } from "../src/lib/auth/users";
import { recordAudit } from "../src/lib/auth/audit";
import { loginAccountKey } from "../src/lib/auth/rate-limit";
import { getDb } from "../src/lib/db/client";
import { askHidden, askVisible, generatePassword } from "./lib/prompt";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente. Rode via `npm run admin:reset`.");
  const generate = process.argv.includes("--generate");

  const email = normalizeEmail(await askVisible("E-mail do admin: "));
  if (!isValidEmail(email)) throw new Error("E-mail inválido.");

  let password: string;
  if (generate) {
    password = generatePassword();
  } else {
    password = await askHidden("Nova senha (12 a 128 caracteres; use uma frase longa): ");
    const again = await askHidden("Repita a nova senha: ");
    if (password !== again) throw new Error("As senhas não conferem.");
  }
  const policy = validateNewPassword(password, { email });
  if (!policy.ok) throw new Error(policy.error);

  const userId = await resetPassword(email, await hashPassword(password));
  if (userId === null) throw new Error("Não existe admin com esse e-mail. Para criar use `npm run admin:create`.");
  await recordAudit({ event: "password_reset_cli", userId });

  // tira os bloqueios de login dessa conta (se SESSION_SECRET estiver disponível para calcular o hash)
  if ((process.env.SESSION_SECRET ?? "").length >= 32) {
    await getDb()`delete from login_attempts where scope = 'login' and account_hash = ${loginAccountKey(email)}`;
  }

  console.log(`\nSenha redefinida para ${email}. Todas as sessões abertas foram encerradas.`);
  if (generate) {
    console.log("\nNOVA SENHA (guarde agora; ela não será mostrada de novo):\n");
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
