-- 阿茶付款權限表
-- 在 Supabase SQL Editor 執行一次。

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_code text not null default 'acha-365-outdoor-fatloss',
  order_id text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  amount numeric(10,2),
  paid_at timestamptz not null default now(),
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_email_status_idx
  on public.entitlements (lower(email), status);

alter table public.entitlements enable row level security;

-- 使用者只能讀自己的付款紀錄；Webhook 使用 service_role，不受此 policy 限制。
drop policy if exists "Users can view own entitlements" on public.entitlements;
create policy "Users can view own entitlements"
  on public.entitlements for select
  using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

-- 前端不可以自行新增、修改或刪除付款權限。
drop policy if exists "No client inserts to entitlements" on public.entitlements;
drop policy if exists "No client updates to entitlements" on public.entitlements;
drop policy if exists "No client deletes to entitlements" on public.entitlements;

create or replace function public.has_active_acha_entitlement()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements
    where lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
      and product_code = 'acha-365-outdoor-fatloss'
      and status = 'active'
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.has_active_acha_entitlement() from public;
grant execute on function public.has_active_acha_entitlement() to authenticated;
