alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text;

alter table public.rings
  add column if not exists color text not null default 'dorado'
  check (color in ('dorado', 'negro', 'plateado'));

notify pgrst, 'reload schema';