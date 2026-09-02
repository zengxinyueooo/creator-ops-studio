create extension if not exists pgcrypto;

create type public.account_kind as enum ('manga', 'growth');
create type public.topic_status as enum ('idea', 'research', 'materials', 'draft', 'review', 'approved', 'published');
create type public.research_status as enum ('queued', 'running', 'imported', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default 'xiaohongshu',
  platform_handle text,
  kind public.account_kind not null,
  positioning text not null default '',
  accent text not null default '#ff5a5f',
  pillars jsonb not null default '[]'::jsonb,
  voice_profile jsonb not null default '{}'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  pillar text not null default '',
  status public.topic_status not null default 'idea',
  score smallint not null default 60 check (score between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  due_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  platform text not null default 'xiaohongshu',
  source_url text not null,
  source_note_id text,
  author_name text,
  title text not null default '',
  body_excerpt text not null default '',
  likes integer not null default 0 check (likes >= 0),
  collects integer not null default 0 check (collects >= 0),
  comments integer not null default 0 check (comments >= 0),
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  insight text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  unique (user_id, source_url)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null default 0,
  source_url text,
  source_type text not null default 'manual',
  content_hash text,
  width integer,
  height integer,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.topic_assets (
  topic_id uuid not null references public.topics(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  position smallint not null default 0,
  is_cover boolean not null default false,
  primary key (topic_id, asset_id)
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  version integer not null default 1,
  title text not null default '',
  body text not null default '',
  hashtags text[] not null default '{}',
  generation_meta jsonb not null default '{}'::jsonb,
  review_status text not null default 'draft' check (review_status in ('draft', 'review', 'approved', 'rejected')),
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, version)
);

create table public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  keyword text not null,
  purpose text not null default '',
  result_limit smallint not null default 20 check (result_limit between 1 and 50),
  status public.research_status not null default 'queued',
  provider text not null default 'opencli',
  command_preview text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('update', 'publish', 'review')),
  starts_at timestamptz,
  recurrence_rule text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  draft_id uuid references public.drafts(id) on delete set null,
  platform_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  likes integer not null default 0,
  collects integer not null default 0,
  comments integer not null default 0,
  followers integer,
  captured_at timestamptz not null default now()
);

create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  key text not null,
  version integer not null default 1,
  instructions text not null,
  output_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, account_id, key, version)
);

create index topics_account_status_idx on public.topics(account_id, status) where archived_at is null;
create index references_account_captured_idx on public.references(account_id, captured_at desc);
create index assets_account_created_idx on public.assets(account_id, created_at desc) where archived_at is null;
create index research_tasks_account_status_idx on public.research_tasks(account_id, status);
create index post_metrics_post_captured_idx on public.post_metrics(post_id, captured_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger topics_updated_at before update on public.topics for each row execute function public.set_updated_at();
create trigger drafts_updated_at before update on public.drafts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.topics enable row level security;
alter table public.references enable row level security;
alter table public.assets enable row level security;
alter table public.topic_assets enable row level security;
alter table public.drafts enable row level security;
alter table public.research_tasks enable row level security;
alter table public.schedules enable row level security;
alter table public.posts enable row level security;
alter table public.post_metrics enable row level security;
alter table public.prompt_templates enable row level security;

create policy profiles_owner_all on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy accounts_owner_all on public.accounts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy topics_owner_all on public.topics for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy references_owner_all on public.references for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assets_owner_all on public.assets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy drafts_owner_all on public.drafts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy research_tasks_owner_all on public.research_tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy schedules_owner_all on public.schedules for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_owner_all on public.posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy post_metrics_owner_all on public.post_metrics for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prompt_templates_owner_all on public.prompt_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy topic_assets_owner_all on public.topic_assets for all to authenticated
using (exists (select 1 from public.topics t where t.id = topic_id and t.user_id = auth.uid()))
with check (exists (select 1 from public.topics t where t.id = topic_id and t.user_id = auth.uid()));

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
