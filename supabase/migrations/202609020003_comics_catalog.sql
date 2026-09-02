-- Comic catalog and relationships for the manga account workflow.
-- This migration is additive: existing records remain valid with comic_id = null.

do $$
begin
  create type public.comic_status as enum (
    'candidate',
    'selected',
    'following',
    'paused',
    'completed',
    'dropped',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.comics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  aliases text[] not null default '{}',
  author_name text,
  platform text not null default 'unknown',
  source_url text,
  cover_url text,
  status public.comic_status not null default 'candidate',
  update_weekday smallint check (update_weekday between 1 and 7),
  update_note text not null default '',
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  selection_note text not null default '',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists comics_user_account_title_idx
  on public.comics(user_id, account_id, lower(title))
  where archived_at is null;

create index if not exists comics_account_status_idx
  on public.comics(account_id, status)
  where archived_at is null;

alter table public.topics
  add column if not exists comic_id uuid references public.comics(id) on delete set null;

alter table public.references
  add column if not exists comic_id uuid references public.comics(id) on delete set null;

alter table public.assets
  add column if not exists comic_id uuid references public.comics(id) on delete set null,
  add column if not exists chapter_label text not null default '',
  add column if not exists characters text[] not null default '{}',
  add column if not exists scene_tags text[] not null default '{}',
  add column if not exists spoiler_level smallint not null default 0
    check (spoiler_level between 0 and 3);

alter table public.research_tasks
  add column if not exists comic_id uuid references public.comics(id) on delete set null;

alter table public.schedules
  add column if not exists comic_id uuid references public.comics(id) on delete set null;

create index if not exists topics_comic_status_idx
  on public.topics(comic_id, status)
  where comic_id is not null and archived_at is null;

create index if not exists references_comic_captured_idx
  on public.references(comic_id, captured_at desc)
  where comic_id is not null;

create index if not exists assets_comic_created_idx
  on public.assets(comic_id, created_at desc)
  where comic_id is not null and archived_at is null;

create index if not exists research_tasks_comic_status_idx
  on public.research_tasks(comic_id, status)
  where comic_id is not null;

create index if not exists schedules_comic_idx
  on public.schedules(comic_id)
  where comic_id is not null;

drop trigger if exists comics_updated_at on public.comics;
create trigger comics_updated_at
  before update on public.comics
  for each row execute function public.set_updated_at();

create or replace function public.validate_comic_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.comic_id is not null and not exists (
    select 1
    from public.comics comic
    where comic.id = new.comic_id
      and comic.user_id = new.user_id
      and comic.account_id = new.account_id
  ) then
    raise exception 'comic_id must belong to the same user and account';
  end if;
  return new;
end;
$$;

drop trigger if exists topics_validate_comic_link on public.topics;
create trigger topics_validate_comic_link
  before insert or update of comic_id, user_id, account_id on public.topics
  for each row execute function public.validate_comic_link();

drop trigger if exists references_validate_comic_link on public.references;
create trigger references_validate_comic_link
  before insert or update of comic_id, user_id, account_id on public.references
  for each row execute function public.validate_comic_link();

drop trigger if exists assets_validate_comic_link on public.assets;
create trigger assets_validate_comic_link
  before insert or update of comic_id, user_id, account_id on public.assets
  for each row execute function public.validate_comic_link();

drop trigger if exists research_tasks_validate_comic_link on public.research_tasks;
create trigger research_tasks_validate_comic_link
  before insert or update of comic_id, user_id, account_id on public.research_tasks
  for each row execute function public.validate_comic_link();

drop trigger if exists schedules_validate_comic_link on public.schedules;
create trigger schedules_validate_comic_link
  before insert or update of comic_id, user_id, account_id on public.schedules
  for each row execute function public.validate_comic_link();

alter table public.comics enable row level security;

drop policy if exists comics_owner_all on public.comics;
create policy comics_owner_all on public.comics
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.comics to authenticated;
revoke all on public.comics from anon;

comment on column public.comics.update_weekday is
  'ISO weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday';

comment on column public.assets.spoiler_level is
  '0=none, 1=light, 2=major, 3=ending spoiler';
