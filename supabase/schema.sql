create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bluetooth_id text not null,
  bluetooth_name text,
  firmware_version text,
  paired_at timestamptz not null default now(),
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, bluetooth_id)
);

create table if not exists public.device_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  heart_rate_interval_minutes integer check (heart_rate_interval_minutes in (30, 60, 120)),
  blood_oxygen_interval_minutes integer check (blood_oxygen_interval_minutes in (30, 60, 120)),
  manual_measurements boolean not null default true,
  sleep_window_start time not null default '22:00',
  sleep_window_end time not null default '08:00',
  updated_at timestamptz not null default now()
);

create table if not exists public.health_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ring_id uuid references public.rings(id) on delete set null,
  metric_type text not null check (metric_type in ('heart_rate', 'blood_oxygen', 'blood_pressure')),
  value numeric,
  systolic_mmhg smallint,
  diastolic_mmhg smallint,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (metric_type in ('heart_rate', 'blood_oxygen') and value is not null and systolic_mmhg is null and diastolic_mmhg is null)
    or (metric_type = 'blood_pressure' and value is null and systolic_mmhg is not null and diastolic_mmhg is not null)
  )
);

create table if not exists public.activity_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ring_id uuid references public.rings(id) on delete set null,
  recorded_on date not null,
  steps integer not null default 0 check (steps >= 0),
  calories_kcal numeric not null default 0 check (calories_kcal >= 0),
  distance_km numeric not null default 0 check (distance_km >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ring_id uuid references public.rings(id) on delete set null,
  sleep_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  total_minutes integer not null check (total_minutes between 0 and 1440),
  quality_score smallint check (quality_score between 0 and 100),
  created_at timestamptz not null default now(),
  check (ended_at > started_at)
);

create index if not exists health_measurements_user_measured_at_idx on public.health_measurements (user_id, measured_at desc);
create index if not exists activity_daily_user_recorded_on_idx on public.activity_daily (user_id, recorded_on desc);
create index if not exists sleep_sessions_user_sleep_date_idx on public.sleep_sessions (user_id, sleep_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;

  insert into public.device_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.device_settings;
create trigger settings_set_updated_at before update on public.device_settings
  for each row execute procedure public.set_updated_at();

drop trigger if exists activity_set_updated_at on public.activity_daily;
create trigger activity_set_updated_at before update on public.activity_daily
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.rings enable row level security;
alter table public.device_settings enable row level security;
alter table public.health_measurements enable row level security;
alter table public.activity_daily enable row level security;
alter table public.sleep_sessions enable row level security;

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "users manage own rings" on public.rings;
create policy "users manage own rings" on public.rings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own settings" on public.device_settings;
create policy "users manage own settings" on public.device_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own health measurements" on public.health_measurements;
create policy "users manage own health measurements" on public.health_measurements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own activity" on public.activity_daily;
create policy "users manage own activity" on public.activity_daily for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own sleep" on public.sleep_sessions;
create policy "users manage own sleep" on public.sleep_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.profiles, public.rings, public.device_settings, public.health_measurements, public.activity_daily, public.sleep_sessions to authenticated;

create or replace function public.purge_heart_ring_history()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.health_measurements where measured_at < now() - interval '7 days';
  delete from public.activity_daily where recorded_on < current_date - 6;
  delete from public.sleep_sessions where sleep_date < current_date - 6;
end;
$$;

create or replace function public.prune_heart_ring_history_after_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.purge_heart_ring_history();
  return new;
end;
$$;

drop trigger if exists prune_measurements_history on public.health_measurements;
create trigger prune_measurements_history after insert on public.health_measurements
  for each statement execute procedure public.prune_heart_ring_history_after_write();
drop trigger if exists prune_activity_history on public.activity_daily;
create trigger prune_activity_history after insert or update on public.activity_daily
  for each statement execute procedure public.prune_heart_ring_history_after_write();
drop trigger if exists prune_sleep_history on public.sleep_sessions;
create trigger prune_sleep_history after insert on public.sleep_sessions
  for each statement execute procedure public.prune_heart_ring_history_after_write();

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-heart-ring-history') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-heart-ring-history';
  end if;
  perform cron.schedule('purge-heart-ring-history', '5 0 * * *', 'select public.purge_heart_ring_history();');
end;
$$;