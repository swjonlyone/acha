-- 阿茶外食減脂 Web App
-- 在 Supabase SQL Editor 執行一次；既有資料庫可執行本檔補欄位。
create extension if not exists pgcrypto;

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  morning_weight numeric(5,2),
  evening_weight numeric(5,2),
  waist_cm numeric(5,2),
  hip_cm numeric(5,2),
  body_fat_pct numeric(5,2) check (body_fat_pct between 1 and 70),
  sleep_hours numeric(4,1) check (sleep_hours between 0 and 24),
  age_years integer check (age_years between 12 and 100),
  height_cm numeric(5,2) check (height_cm between 100 and 230),
  reference_sex text check (reference_sex in ('female', 'male')),
  meals jsonb not null default '{}'::jsonb,
  eating_out_count integer not null default 0 check (eating_out_count between 0 and 10),
  plate_pattern text check (plate_pattern in ('211', '221')),
  protein_status text,
  vegetables_status text,
  drinks text,
  exercise text,
  exercise_minutes integer not null default 0 check (exercise_minutes between 0 and 600),
  water_ml integer not null default 0 check (water_ml between 0 and 20000),
  slept_well boolean not null default false,
  bowel_movement boolean not null default false,
  mood integer check (mood between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.daily_logs add column if not exists plate_pattern text check (plate_pattern in ('211', '221'));
alter table public.daily_logs add column if not exists hip_cm numeric(5,2);
alter table public.daily_logs add column if not exists body_fat_pct numeric(5,2);
alter table public.daily_logs add column if not exists sleep_hours numeric(4,1);
alter table public.daily_logs add column if not exists age_years integer;
alter table public.daily_logs add column if not exists height_cm numeric(5,2);
alter table public.daily_logs add column if not exists reference_sex text;

create index if not exists daily_logs_user_date_idx on public.daily_logs(user_id, log_date desc);

alter table public.daily_logs enable row level security;

drop policy if exists "Users can view their own logs" on public.daily_logs;
create policy "Users can view their own logs" on public.daily_logs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own logs" on public.daily_logs;
create policy "Users can insert their own logs" on public.daily_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own logs" on public.daily_logs;
create policy "Users can update their own logs" on public.daily_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own logs" on public.daily_logs;
create policy "Users can delete their own logs" on public.daily_logs
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_logs_updated_at on public.daily_logs;
create trigger daily_logs_updated_at before update on public.daily_logs
for each row execute function public.set_updated_at();
