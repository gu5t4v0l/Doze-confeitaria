/**
 * Esquema do banco (Postgres/Neon). Todas as instruções são idempotentes:
 * `npm run db:migrate` pode ser executado quantas vezes for preciso.
 * Preços SEMPRE em centavos inteiros.
 */
export const schemaStatements: string[] = [
  `create table if not exists categories (
    id serial primary key,
    slug text not null unique,
    name text not null,
    note text,
    emoji text not null default '🍰',
    tone text not null default 'default' check (tone in ('default', 'festive')),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists items (
    id serial primary key,
    slug text not null unique,
    category_id integer not null references categories(id) on delete restrict,
    name text not null,
    description text,
    price_cents integer not null check (price_cents >= 0),
    image_url text,
    emoji text,
    gluten_free boolean not null default false,
    active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists items_category_sort_idx on items (category_id, sort_order)`,
  `create table if not exists item_options (
    id serial primary key,
    item_id integer not null references items(id) on delete cascade,
    label text not null,
    price_cents integer not null check (price_cents >= 0),
    sort_order integer not null default 0
  )`,
  `create index if not exists item_options_item_idx on item_options (item_id, sort_order)`,
  `create table if not exists settings (
    id integer primary key default 1 check (id = 1),
    whatsapp_number text not null,
    instagram_handle text not null,
    order_deadline date,
    last_delivery_date date,
    min_lead_days integer not null default 3 check (min_lead_days >= 0),
    notice_lines text not null default '',
    updated_at timestamptz not null default now()
  )`,
  // Pagamento (sinal por Pix). Aditivo e idempotente: só cria a coluna se ainda não existir.
  `alter table settings add column if not exists deposit_percent integer not null default 50 check (deposit_percent between 0 and 100)`,
  `alter table settings add column if not exists pix_key text not null default '' check (char_length(pix_key) <= 140)`,
  `alter table settings add column if not exists pix_key_type text not null default '' check (pix_key_type in ('', 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'))`,
  `alter table settings add column if not exists pix_holder text not null default '' check (char_length(pix_holder) <= 80)`,
  `alter table settings add column if not exists payment_note text not null default '' check (char_length(payment_note) <= 300)`,
  `create table if not exists login_attempts (
    id bigserial primary key,
    ip_hash text not null,
    success boolean not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists login_attempts_ip_idx on login_attempts (ip_hash, created_at)`,
  `create index if not exists login_attempts_created_idx on login_attempts (created_at)`,
];
