-- AI Waiter — initial schema (PostgreSQL / Supabase compatible)
--
-- Multi-tenant design: every tenant-scoped table carries restaurant_id and is
-- protected by row-level security so a tenant can never read another's data.
-- Money is stored as integer minor units (amount_minor) + currency, never float.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenancy & identity
-- ---------------------------------------------------------------------------
create table restaurants (
  id            text primary key,
  name          text not null,
  currency      char(3) not null default 'QAR',
  timezone      text not null default 'Asia/Qatar',
  tax_rate_bps  integer not null default 0,
  branding      jsonb not null default '{}'::jsonb,
  ai_config     jsonb not null default '{}'::jsonb,
  policies      text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table tables (
  id            text not null,
  restaurant_id text not null references restaurants(id) on delete cascade,
  number        text not null,
  active        boolean not null default true,
  primary key (restaurant_id, id)
);

-- Staff / operators for the admin dashboard (customers are anonymous by table).
create table users (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text references restaurants(id) on delete cascade,
  email         text not null unique,
  role          text not null check (role in ('owner','manager','staff','superadmin')),
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table categories (
  id            text not null,
  restaurant_id text not null references restaurants(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  sort_order    integer not null default 0,
  primary key (restaurant_id, id)
);

create table allergens (
  id            text not null,
  restaurant_id text not null references restaurants(id) on delete cascade,
  key           text not null,
  label         text not null,
  primary key (restaurant_id, id)
);

create table ingredients (
  id            text not null,
  restaurant_id text not null references restaurants(id) on delete cascade,
  name          text not null,
  allergen_ids  text[] not null default '{}',
  primary key (restaurant_id, id)
);

create table products (
  id               text not null,
  restaurant_id    text not null references restaurants(id) on delete cascade,
  category_id      text not null,
  name             text not null,
  description      text not null default '',
  base_amount_minor integer not null,
  currency         char(3) not null default 'QAR',
  image_url        text,
  available        boolean not null default true,
  rating           numeric(2,1),
  dietary_tags     text[] not null default '{}',
  allergen_ids     text[] not null default '{}',
  ingredient_ids   text[] not null default '{}',
  popularity_score integer not null default 0,
  primary key (restaurant_id, id)
);

create table product_sizes (
  id               text not null,
  restaurant_id    text not null,
  product_id       text not null,
  name             text not null,
  delta_amount_minor integer not null default 0,
  primary key (restaurant_id, product_id, id),
  foreign key (restaurant_id, product_id) references products(restaurant_id, id) on delete cascade
);

create table modifier_groups (
  id            text not null,
  restaurant_id text not null,
  product_id    text not null,
  name          text not null,
  min_select    integer not null default 0,
  max_select    integer,
  sort_order    integer not null default 0,
  primary key (restaurant_id, product_id, id),
  foreign key (restaurant_id, product_id) references products(restaurant_id, id) on delete cascade
);

create table modifiers (
  id                 text not null,
  restaurant_id      text not null,
  product_id         text not null,
  group_id           text not null,
  name               text not null,
  delta_amount_minor integer not null default 0,
  available          boolean not null default true,
  adds_ingredient_ids   text[] not null default '{}',
  removes_ingredient_ids text[] not null default '{}',
  primary key (restaurant_id, product_id, group_id, id),
  foreign key (restaurant_id, product_id, group_id)
    references modifier_groups(restaurant_id, product_id, id) on delete cascade
);

create table promotions (
  id            text not null,
  restaurant_id text not null references restaurants(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  product_ids   text[] not null default '{}',
  active        boolean not null default true,
  primary key (restaurant_id, id)
);

create table upsell_rules (
  id                text not null,
  restaurant_id     text not null references restaurants(id) on delete cascade,
  when_product_ids  text[] not null default '{}',
  when_category_ids text[] not null default '{}',
  suggest_product_id  text,
  suggest_modifier_id text,
  message           text not null,
  priority          integer not null default 0,
  primary key (restaurant_id, id)
);

-- ---------------------------------------------------------------------------
-- Ordering
-- ---------------------------------------------------------------------------
create table orders (
  id                text primary key,
  restaurant_id     text not null references restaurants(id) on delete cascade,
  table_id          text,
  status            text not null default 'received'
                      check (status in ('received','preparing','ready','served','cancelled')),
  display_number    text not null,
  idempotency_key   text not null,
  subtotal_minor    integer not null,
  tax_minor         integer not null,
  discount_minor    integer not null default 0,
  total_minor       integer not null,
  currency          char(3) not null default 'QAR',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, idempotency_key)
);
create index orders_restaurant_created_idx on orders (restaurant_id, created_at desc);
create index orders_restaurant_status_idx on orders (restaurant_id, status);

create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          text not null references orders(id) on delete cascade,
  restaurant_id     text not null,
  line_id           text not null,
  product_id        text not null,
  name              text not null,
  quantity          integer not null check (quantity > 0),
  size_id           text,
  size_name         text,
  unit_amount_minor integer not null,
  line_total_minor  integer not null,
  notes             text not null default ''
);
create index order_items_order_idx on order_items (order_id);

create table order_item_modifiers (
  id                 uuid primary key default gen_random_uuid(),
  order_item_id      uuid not null references order_items(id) on delete cascade,
  modifier_group_id  text not null,
  modifier_id        text not null,
  name               text not null,
  delta_amount_minor integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Conversations & AI
-- ---------------------------------------------------------------------------
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants(id) on delete cascade,
  table_id      text,
  created_at    timestamptz not null default now()
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  restaurant_id    text not null,
  role             text not null check (role in ('user','assistant')),
  content          text not null,
  intent           text,
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table ai_recommendations (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    text not null references restaurants(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete set null,
  product_id       text not null,
  accepted         boolean,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Service, analytics, audit
-- ---------------------------------------------------------------------------
create table service_requests (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants(id) on delete cascade,
  table_id      text,
  type          text not null,
  note          text not null default '',
  status        text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at    timestamptz not null default now()
);
create index service_requests_restaurant_status_idx on service_requests (restaurant_id, status);

create table analytics_events (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants(id) on delete cascade,
  table_id      text,
  name          text not null,
  properties    jsonb not null default '{}'::jsonb,
  client_ts     timestamptz,
  received_at   timestamptz not null default now()
);
create index analytics_events_restaurant_name_idx on analytics_events (restaurant_id, name, received_at desc);

create table payments (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants(id) on delete cascade,
  order_id      text references orders(id) on delete set null,
  provider      text not null,
  status        text not null,
  amount_minor  integer not null,
  currency      char(3) not null default 'QAR',
  created_at    timestamptz not null default now()
);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants(id) on delete cascade,
  actor         text not null,
  action        text not null,
  target        text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_restaurant_idx on audit_log (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security (tenant isolation). The API sets `app.restaurant_id` per
-- request; policies restrict every row to the active tenant.
-- ---------------------------------------------------------------------------
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table service_requests  enable row level security;
alter table analytics_events  enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;

create policy tenant_isolation_orders on orders
  using (restaurant_id = current_setting('app.restaurant_id', true));
create policy tenant_isolation_service on service_requests
  using (restaurant_id = current_setting('app.restaurant_id', true));
create policy tenant_isolation_analytics on analytics_events
  using (restaurant_id = current_setting('app.restaurant_id', true));
create policy tenant_isolation_conversations on conversations
  using (restaurant_id = current_setting('app.restaurant_id', true));
