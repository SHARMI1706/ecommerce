-- supabase_orders_table.sql
create extension if not exists pgcrypto;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  customer_name text,
  phone text,
  address text,
  items jsonb,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  payment_method text,
  status text,
  created_at timestamptz default now()
);

create index on public.orders (user_email);
create index on public.orders (created_at desc);

-- Recommended RLS policies:
-- alter table public.orders enable row level security;
-- create policy insert_own_order on public.orders
--   for insert
--   with check (user_email = auth.jwt() ->> 'email');
-- create policy select_own_orders on public.orders
--   for select
--   using (user_email = auth.jwt() ->> 'email');
