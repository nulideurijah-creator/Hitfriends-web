create table if not exists public.game_rooms (
  id text primary key,
  mode text not null default 'casual',
  players jsonb not null default '[]'::jsonb,
  state jsonb,
  phase text not null default 'waiting_ready',
  phase_data jsonb not null default '{}'::jsonb,
  score_history jsonb not null default '[]'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.game_rooms
  add column if not exists phase text not null default 'waiting_ready';

alter table public.game_rooms
  add column if not exists mode text not null default 'casual';

alter table public.game_rooms
  add column if not exists phase_data jsonb not null default '{}'::jsonb;

alter table public.game_rooms
  add column if not exists score_history jsonb not null default '[]'::jsonb;

alter table public.game_rooms
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists game_rooms_created_at_idx
  on public.game_rooms (created_at desc);

create index if not exists game_rooms_phase_idx
  on public.game_rooms (phase);

create index if not exists game_rooms_expires_at_idx
  on public.game_rooms (expires_at);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text not null,
  avatar_url text,
  avatar_path text,
  score integer not null default 0,
  games_played integer not null default 0,
  wins integer not null default 0,
  best_single_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_score_idx
  on public.profiles (score desc, wins desc);

alter table public.profiles
  add column if not exists avatar_path text;

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.game_rooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role text not null default 'player',
  message_type text not null default 'chat',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_created_idx
  on public.room_messages (room_id, created_at desc);

create table if not exists public.room_spectators (
  room_id text not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  watching_player_id text,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_spectators_room_seen_idx
  on public.room_spectators (room_id, last_seen_at desc);

create table if not exists public.room_settlement_records (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  mode text not null default 'casual',
  room_session_id text not null,
  participant_signature text not null,
  participant_ids text[] not null default '{}',
  participants jsonb not null default '[]'::jsonb,
  score_history jsonb not null default '[]'::jsonb,
  winner_id text,
  settled_by uuid references auth.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, room_session_id, participant_signature)
);

create index if not exists room_settlement_records_player_idx
  on public.room_settlement_records using gin (participant_ids);

create index if not exists room_settlement_records_settled_at_idx
  on public.room_settlement_records (settled_at desc);

alter table public.room_settlement_records
  add column if not exists mode text not null default 'casual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_rooms_mode_check'
  ) then
    alter table public.game_rooms
      add constraint game_rooms_mode_check check (mode in ('casual', 'ladder'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'room_settlement_records_mode_check'
  ) then
    alter table public.room_settlement_records
      add constraint room_settlement_records_mode_check check (mode in ('casual', 'ladder'));
  end if;
end;
$$;

create table if not exists public.app_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from public.app_migrations where id = '20260427_reset_scores_for_room_modes'
  ) then
    update public.profiles
    set
      score = 0,
      games_played = 0,
      wins = 0,
      best_single_score = 0,
      updated_at = now();

    delete from public.room_settlement_records;

    insert into public.app_migrations (id)
    values ('20260427_reset_scores_for_room_modes');
  end if;
end;
$$;

create or replace function public.set_updated_at()
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
execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.delete_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.game_rooms
  where expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.game_rooms enable row level security;
alter table public.profiles enable row level security;
alter table public.room_messages enable row level security;
alter table public.room_spectators enable row level security;
alter table public.room_settlement_records enable row level security;

drop policy if exists "game_rooms_read_all" on public.game_rooms;
drop policy if exists "game_rooms_insert_authenticated" on public.game_rooms;
drop policy if exists "game_rooms_update_authenticated" on public.game_rooms;
drop policy if exists "game_rooms_delete_player" on public.game_rooms;
drop policy if exists "game_rooms_insert_all" on public.game_rooms;
drop policy if exists "game_rooms_update_all" on public.game_rooms;

create policy "game_rooms_read_all"
on public.game_rooms
for select
to anon, authenticated
using (true);

create policy "game_rooms_insert_authenticated"
on public.game_rooms
for insert
to authenticated
with check (true);

create policy "game_rooms_update_authenticated"
on public.game_rooms
for update
to authenticated
using (true)
with check (true);

create policy "game_rooms_delete_player"
on public.game_rooms
for delete
to authenticated
using (
  exists (
    select 1
    from jsonb_array_elements(players) as player
    where player->>'id' = auth.uid()::text
      and coalesce((player->>'isHost')::boolean, false)
  )
);

drop policy if exists "profiles_read_all" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_dev" on public.profiles;

create policy "profiles_read_all"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Dev-friendly: clients update scoreboard after a game. Replace with RPC/server validation before production.
create policy "profiles_update_own_or_dev"
on public.profiles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "room_messages_read_all" on public.room_messages;
drop policy if exists "room_messages_insert_authenticated" on public.room_messages;
drop policy if exists "room_spectators_read_all" on public.room_spectators;
drop policy if exists "room_spectators_insert_own" on public.room_spectators;
drop policy if exists "room_spectators_update_own" on public.room_spectators;
drop policy if exists "room_spectators_delete_own" on public.room_spectators;
drop policy if exists "room_settlement_records_read_participant" on public.room_settlement_records;
drop policy if exists "room_settlement_records_insert_participant" on public.room_settlement_records;
drop policy if exists "room_settlement_records_update_participant" on public.room_settlement_records;

create policy "room_messages_read_all"
on public.room_messages
for select
to anon, authenticated
using (true);

create policy "room_messages_insert_authenticated"
on public.room_messages
for insert
to authenticated
with check (
  message_type = 'system'
  or sender_id = auth.uid()
);

create policy "room_spectators_read_all"
on public.room_spectators
for select
to anon, authenticated
using (true);

create policy "room_spectators_insert_own"
on public.room_spectators
for insert
to authenticated
with check (user_id = auth.uid());

create policy "room_spectators_update_own"
on public.room_spectators
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "room_spectators_delete_own"
on public.room_spectators
for delete
to authenticated
using (user_id = auth.uid());

create policy "room_settlement_records_read_participant"
on public.room_settlement_records
for select
to authenticated
using (auth.uid()::text = any(participant_ids));

create policy "room_settlement_records_insert_participant"
on public.room_settlement_records
for insert
to authenticated
with check (
  settled_by = auth.uid()
  and auth.uid()::text = any(participant_ids)
);

create policy "room_settlement_records_update_participant"
on public.room_settlement_records
for update
to authenticated
using (auth.uid()::text = any(participant_ids))
with check (auth.uid()::text = any(participant_ids));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read_all" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_read_all"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
