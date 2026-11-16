// Entrada interativa para os scripts de admin. A senha NUNCA vem por argv (ficaria no histórico do shell).
// - Terminal interativo: e-mail visível, senha com entrada OCULTA e confirmação.
// - Sem terminal (automação/testes): lê linhas da entrada padrão (e-mail, depois senha e confirmação).
import { randomInt } from "node:crypto";
import { GENERATED_ALPHABET } from "../../src/lib/auth/password-policy";

const interactive = Boolean(process.stdin.isTTY);

let pipedLines: string[] | null = null;
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  }
  return pipedLines.shift() ?? "";
}

export async function askVisible(question: string): Promise<string> {
  if (!interactive) return (await nextPipedLine()).trim();
  process.stdout.write(question);
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    let buf = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.off("data", onData);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(buf.trim());
          return;
        }
        if (ch === "\u0003") process.exit(130);
        buf += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

/** Senha com entrada oculta (nada é ecoado). Sem terminal, lê da entrada padrão. */
export async function askHidden(question: string): Promise<string> {
  if (!interactive) return nextPipedLine();
  process.stdout.write(question);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let buf = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.off("data", onData);
          stdin.pause();
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else if (ch >= " ") buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/** 20 caracteres aleatórios (sem 0/O/1/l/I), em 4 grupos: fácil de ler e digitar no celular. */
export function generatePassword(): string {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => GENERATED_ALPHABET[randomInt(GENERATED_ALPHABET.length)]).join(""),
  );
  return groups.join("-");
}
