create table if not exists public.game_rooms (
  id text primary key,
  players jsonb not null default '[]'::jsonb,
  state jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_created_at_idx
  on public.game_rooms (created_at desc);

create or replace function public.set_game_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_game_rooms_updated_at on public.game_rooms;

create trigger set_game_rooms_updated_at
before update on public.game_rooms
for each row
execute function public.set_game_rooms_updated_at();

-- Development policy. For production, replace this with authenticated
-- user policies or RPC functions that validate room membership server-side.
alter table public.game_rooms enable row level security;

drop policy if exists "game_rooms_read_all" on public.game_rooms;
drop policy if exists "game_rooms_insert_all" on public.game_rooms;
drop policy if exists "game_rooms_update_all" on public.game_rooms;

create policy "game_rooms_read_all"
on public.game_rooms
for select
to anon, authenticated
using (true);

create policy "game_rooms_insert_all"
on public.game_rooms
for insert
to anon, authenticated
with check (true);

create policy "game_rooms_update_all"
on public.game_rooms
for update
to anon, authenticated
using (true)
with check (true);
