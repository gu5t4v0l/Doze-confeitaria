# DoZé Confeitaria — cardápio virtual

Cardápio mobile-first com carrinho e envio do pedido pelo WhatsApp, lido de um banco de dados
e editável pela dona em **/admin**. Next.js 16 (App Router, Cache Components) + TypeScript +
Tailwind + shadcn/ui, Neon Postgres e Vercel Blob (fotos).

## Como a dona usa o painel (passo a passo)

1. Abra `seusite.com/admin` no celular e digite a senha. (Dica: salve nos favoritos.)
2. **Mudar preço ou foto:** toque em **Editar** no item, altere o que quiser e toque em **Salvar**.
3. **Esconder um item** (acabou, não faz mais): use o interruptor **Disponível / Escondido**. Ele some
   do cardápio, mas não é apagado — dá para voltar a mostrar depois.
4. **Novo item:** **Novo item** → foto (**Tirar foto** ou **Escolher da galeria**), nome, preço,
   categoria. Para tamanhos/recheios com preços diferentes use **Adicionar opções**.
5. **Ordem:** setas para cima/baixo ao lado de cada item ou categoria.
6. **Apagar:** o botão da lixeira pergunta antes e oferece **Só esconder**.
7. **Datas e avisos:** aba **Configurações** (último dia de pedidos, última entrega, antecedência,
   WhatsApp, avisos). Depois da data limite o cardápio mostra “Pedidos encerrados” e o envio fica bloqueado.
8. **Pagamento (sinal por Pix):** em **Configurações → Pagamento**. A confeitaria só trabalha por encomenda:
   toda encomenda exige um sinal antecipado (padrão **50%**) e o restante é pago na entrega/retirada.
   **Antes de divulgar o cardápio, preencha a chave Pix** (tipo, chave e nome do favorecido). Sem chave, o
   cliente vê “A chave Pix será enviada na confirmação do pedido”. Use 0% para desativar o sinal.
9. **Ver cardápio** abre o site; **Sair** encerra a sessão. As mudanças aparecem na hora.

## Pagamento: sinal por Pix

- O site **não cobre nada**: o pedido segue por `wa.me` e o Pix é combinado no WhatsApp. O carrinho mostra
  Total, Sinal e Restante; a mensagem do WhatsApp traz as mesmas linhas e pede a chave Pix.
- Configurável em **/admin → Configurações** (tabela `settings`): `deposit_percent` (0–100, padrão 50),
  `pix_key`, `pix_key_type` (cpf, cnpj, email, telefone, aleatoria), `pix_holder`, `payment_note`.
  A chave é validada por tipo no servidor. Ela é pública por natureza (aparece no carrinho) e nunca é logada.
- Cálculo em `src/lib/payment.ts` (centavos inteiros; sinal arredondado, restante = total − sinal).
- Colunas novas entram por `npm run db:migrate` (aditivo e idempotente; não apaga dados). Depois da migração,
  o padrão é 50% e sem chave Pix.

## Como rodar

```bash
npm install --legacy-peer-deps   # (se der ERESOLVE do vitest)
cp .env.example .env.local       # preencha (ou `vercel env pull .env.local`)
npm run db:migrate               # cria as tabelas (idempotente)
npm run db:seed                  # carrega o cardápio inicial de src/data/menu.ts (só o que falta)
npm run dev                      # http://localhost:3000
npm test && npm run lint && npm run build
```

Se o banco ficar fora do ar, o site mostra o cardápio estático de `src/data/menu.ts` em vez de quebrar.

## Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (integração do Marketplace já a cria) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (fotos) |
| `ADMIN_PASSWORD_HASH` | Hash scrypt da senha do painel |
| `SESSION_SECRET` | Assina a sessão (>= 32 caracteres aleatórios) |
| `NEXT_PUBLIC_SITE_URL` | URL pública (metatags/OG) |

### Gerar a senha e o SESSION_SECRET (produção)

```bash
npm run admin:hash                       # gera senha forte aleatória
echo 'minha-senha-longa' | npm run admin:hash -- --stdin   # ou usa uma senha sua (>= 10 caracteres)
```

O comando imprime `ADMIN_PASSWORD_HASH`, um `SESSION_SECRET` novo e (no modo aleatório) a senha,
**uma única vez**. Nada é gravado em arquivo. Entregue a senha à dona e cadastre na Vercel:

```bash
vercel env add ADMIN_PASSWORD_HASH production
vercel env add SESSION_SECRET production
```

Trocar `ADMIN_PASSWORD_HASH` encerra todas as sessões abertas. Depois de alterar variáveis, faça um novo deploy.

## Segurança do painel

- Senha única (scrypt + `timingSafeEqual`), sessão em cookie JWT assinado (`httpOnly`, `Secure`,
  `SameSite=Lax`, 48 horas, prefixo `__Host-` em produção).
- Bloqueio progressivo no banco (5 falhas em 15 min por IP, e limite global), com atraso constante no login.
- `src/proxy.ts` é só a primeira barreira; páginas, Server Actions e o endpoint de upload reverificam a sessão.
- Todas as entradas são validadas no servidor (zod); fotos só do nosso store de Blob (`itens/`).
- `/admin` é `noindex`, fora do `robots` e com `Cache-Control: no-store`.

## Se a dona ficar trancada fora do painel

- O bloqueio por tentativas erradas dura até 15 minutos e some sozinho.
- Para liberar na hora, rode no console SQL do Neon: `delete from login_attempts;`
- Trocar `ADMIN_PASSWORD_HASH` derruba todas as sessões abertas (é preciso entrar de novo com a nova senha).

## Estrutura

- `src/data/menu.ts` — seed e plano B do cardápio (preços em centavos)
- `src/lib/db`, `src/lib/menu-queries.ts` — Neon (conexão preguiçosa) e leitura em cache (`use cache` + tag `menu`)
- `src/lib/admin` — validação (zod) e mutações do banco; `src/app/admin/actions.ts` — Server Actions
- `src/lib/auth` — senha, sessão, bloqueio de login
- `src/lib/cart.ts`, `cart-store.ts`, `whatsapp.ts`, `payment.ts`, `dates.ts`, `money.ts` — carrinho, mensagem, datas (America/Sao_Paulo), centavos
- `scripts/` — `db-migrate`, `db-seed`, `admin-hash`, `make-brand-assets` (logo a partir de `sources/`)
- `src/components/admin` — interface do painel

O carrinho fica só no `localStorage` e é validado contra o catálogo vindo do servidor: itens
removidos/escondidos são descartados e o preço vem sempre do banco.

## Deploy na Vercel

1. Projeto já vinculado (Neon e Blob provisionados). Defina as variáveis da tabela acima em **Production**.
2. Rode `npm run db:migrate && npm run db:seed` uma vez contra o banco de produção
   (`vercel env pull` para obter `DATABASE_URL`).
3. Faça o deploy. Cada mudança no painel atualiza a vitrine na hora (revalidação da tag `menu`).
