alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text;

alter table public.rings
  add column if not exists color text not null default 'dorado'
  check (color in ('dorado', 'negro', 'plateado'));

alter table public.rings
  add column if not exists hardware_profile jsonb not null default '{}'::jsonb;

with ranked_rings as (
  select id, row_number() over (partition by user_id order by paired_at desc, created_at desc) as row_number
  from public.rings
)
delete from public.rings
where id in (select id from ranked_rings where row_number > 1);

create unique index if not exists rings_one_per_user_idx on public.rings (user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['health_measurements', 'activity_daily', 'sleep_sessions', 'rings'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1
        from pg_publication_rel relation
        join pg_class class on class.oid = relation.prrelid
        where relation.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
          and class.oid = format('public.%I', table_name)::regclass
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';