create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  category text not null default 'creatine',
  retailer text not null,
  product_name text not null,
  image_url text,
  size_grams integer not null,
  available boolean not null default true,
  product_state text not null default 'active',
  pickup_available boolean not null default false,
  delivery_available boolean not null default true,
  pickup_note text,
  shipping_note text,
  last_item_price numeric(10, 2),
  last_shipping_price numeric(10, 2),
  last_delivered_total numeric(10, 2),
  last_price_per_100g numeric(10, 2),
  last_rating numeric(3, 2),
  last_review_count integer,
  metadata jsonb not null default '{}'::jsonb,
  last_fetch_status text,
  last_fetch_error text,
  last_seen_at timestamptz,
  last_checked_at timestamptz,
  last_available_at timestamptz,
  last_unavailable_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category text not null default 'creatine',
  add column if not exists available boolean not null default true,
  add column if not exists product_state text not null default 'active',
  add column if not exists last_item_price numeric(10, 2),
  add column if not exists last_shipping_price numeric(10, 2),
  add column if not exists last_delivered_total numeric(10, 2),
  add column if not exists last_price_per_100g numeric(10, 2),
  add column if not exists last_rating numeric(3, 2),
  add column if not exists last_review_count integer,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_available_at timestamptz,
  add column if not exists last_unavailable_at timestamptz;

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  observed_at timestamptz not null,
  currency text not null default 'NZD',
  item_price numeric(10, 2) not null,
  shipping_price numeric(10, 2),
  delivered_total numeric(10, 2) not null,
  price_per_100g numeric(10, 2) not null,
  rating numeric(3, 2),
  review_count integer,
  fetch_status text,
  fetch_error text,
  created_at timestamptz not null default now()
);

create index if not exists price_history_product_observed_idx
  on public.price_history (product_id, observed_at desc);

create index if not exists products_category_available_idx
  on public.products (category, available, last_price_per_100g);

create table if not exists public.product_availability_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  observed_at timestamptz not null,
  available boolean not null,
  product_state text not null,
  fetch_status text,
  fetch_error text,
  created_at timestamptz not null default now()
);

create index if not exists availability_history_product_observed_idx
  on public.product_availability_history (product_id, observed_at desc);

create table if not exists public.outbound_clicks (
  id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default now(),
  source_url text not null,
  retailer text not null,
  product_name text not null,
  category text not null default 'unknown',
  click_location text not null,
  page_path text,
  session_id text,
  ip_hash text,
  dedupe_key text,
  credible_click boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.outbound_clicks
  add column if not exists session_id text,
  add column if not exists ip_hash text,
  add column if not exists dedupe_key text,
  add column if not exists credible_click boolean not null default true;

create index if not exists outbound_clicks_observed_idx
  on public.outbound_clicks (observed_at desc);

create index if not exists outbound_clicks_retailer_category_idx
  on public.outbound_clicks (retailer, category, observed_at desc);

create index if not exists outbound_clicks_source_idx
  on public.outbound_clicks (source_url, observed_at desc);

create index if not exists outbound_clicks_credible_observed_idx
  on public.outbound_clicks (credible_click, observed_at desc);

create index if not exists outbound_clicks_dedupe_observed_idx
  on public.outbound_clicks (dedupe_key, observed_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default now(),
  event_type text not null,
  category text,
  session_id text,
  ip_hash text,
  page_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_observed_idx
  on public.analytics_events (observed_at desc);

create index if not exists analytics_events_type_observed_idx
  on public.analytics_events (event_type, observed_at desc);

create index if not exists analytics_events_category_observed_idx
  on public.analytics_events (category, observed_at desc);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_type text not null default 'general',
  message text not null,
  category text,
  product_name text,
  retailer text,
  source_url text,
  page_path text,
  status text not null default 'new'
);

create index if not exists feedback_reports_created_idx
  on public.feedback_reports (created_at desc);

create index if not exists feedback_reports_status_idx
  on public.feedback_reports (status, created_at desc);

create table if not exists public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered_count integer,
  total_products integer,
  live_products integer,
  history_rows integer,
  availability_rows integer,
  supabase_enabled boolean,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists refresh_runs_started_idx
  on public.refresh_runs (started_at desc);

create index if not exists refresh_runs_status_started_idx
  on public.refresh_runs (status, started_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();
