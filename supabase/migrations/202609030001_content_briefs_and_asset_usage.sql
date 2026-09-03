-- Content brief, source-note detail, visual classification, and reusable asset history.
-- Additive migration: existing topics, references, assets, and posts remain valid.

do $$
begin
  create type public.asset_visual_format as enum ('single', 'collage', 'uncertain', 'invalid');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.asset_review_status as enum ('pending', 'available', 'rejected', 'archived');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.asset_use_type as enum ('cover', 'body');
exception
  when duplicate_object then null;
end
$$;

alter table public.topics
  add column if not exists brief jsonb not null default '{}'::jsonb;

alter table public.references
  add column if not exists body_text text not null default '',
  add column if not exists image_count smallint not null default 0 check (image_count >= 0),
  add column if not exists cover_url text,
  add column if not exists detail_status text not null default 'list_only'
    check (detail_status in ('list_only', 'detailed', 'failed')),
  add column if not exists review_status text not null default 'candidate'
    check (review_status in ('candidate', 'kept', 'rejected'));

alter table public.assets
  add column if not exists visual_format public.asset_visual_format not null default 'uncertain',
  add column if not exists classification_confidence numeric(4,3)
    check (classification_confidence between 0 and 1),
  add column if not exists classification_note text not null default '',
  add column if not exists review_status public.asset_review_status not null default 'pending',
  add column if not exists content_type text not null default 'other'
    check (content_type in ('cover', 'character', 'interaction', 'plot', 'dialogue', 'atmosphere', 'other'));

alter table public.research_tasks
  add column if not exists keywords text[] not null default '{}',
  add column if not exists filter_config jsonb not null default jsonb_build_object(
    'noteType', 'image',
    'publishedWithin', 'week',
    'scope', 'unseen',
    'sort', 'most_liked'
  );

update public.research_tasks
set keywords = array[keyword]
where cardinality(keywords) = 0;

do $$
begin
  alter table public.research_tasks
    add constraint research_tasks_keywords_batch_check
    check (cardinality(keywords) between 1 and 3);
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.asset_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  post_id uuid not null references public.posts(id) on delete cascade,
  use_type public.asset_use_type not null default 'body',
  position smallint not null default 0,
  used_at timestamptz not null default now(),
  unique (post_id, asset_id)
);

create index if not exists asset_usages_asset_used_idx
  on public.asset_usages(asset_id, used_at desc);

create index if not exists asset_usages_topic_idx
  on public.asset_usages(topic_id)
  where topic_id is not null;

alter table public.asset_usages enable row level security;

create or replace function public.validate_topic_asset_selectable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assets asset
    join public.topics topic on topic.id = new.topic_id
    where asset.id = new.asset_id
      and asset.user_id = topic.user_id
      and asset.account_id = topic.account_id
      and asset.visual_format = 'single'::public.asset_visual_format
      and asset.review_status = 'available'::public.asset_review_status
  ) then
    raise exception 'Only available single-image assets can be selected for a topic';
  end if;
  return new;
end;
$$;

drop trigger if exists topic_assets_validate_selectable on public.topic_assets;
create trigger topic_assets_validate_selectable
  before insert or update of topic_id, asset_id on public.topic_assets
  for each row execute function public.validate_topic_asset_selectable();

drop policy if exists asset_usages_owner_all on public.asset_usages;
create policy asset_usages_owner_all on public.asset_usages
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.assets asset
      where asset.id = asset_usages.asset_id
        and asset.user_id = auth.uid()
        and asset.account_id = asset_usages.account_id
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.assets asset
      where asset.id = asset_usages.asset_id
        and asset.user_id = auth.uid()
        and asset.account_id = asset_usages.account_id
    )
    and exists (
      select 1 from public.posts post
      where post.id = asset_usages.post_id
        and post.user_id = auth.uid()
        and post.account_id = asset_usages.account_id
    )
  );

grant select, insert, update, delete on public.asset_usages to authenticated;
revoke all on public.asset_usages from anon;

create or replace function public.mark_topic_published(p_topic_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_post_id uuid;
begin
  select topic.account_id
  into v_account_id
  from public.topics topic
  where topic.id = p_topic_id
    and topic.user_id = v_user_id;

  if v_account_id is null then
    raise exception 'Topic not found or not owned by the current user';
  end if;

  if not exists (
    select 1
    from public.topic_assets link
    join public.assets asset on asset.id = link.asset_id
    where link.topic_id = p_topic_id
      and asset.user_id = v_user_id
      and asset.account_id = v_account_id
      and asset.visual_format = 'single'::public.asset_visual_format
      and asset.review_status = 'available'::public.asset_review_status
  ) then
    raise exception 'Select at least one available single-image asset before publishing';
  end if;

  select post.id
  into v_post_id
  from public.posts post
  where post.topic_id = p_topic_id
    and post.user_id = v_user_id
  order by post.created_at desc
  limit 1;

  if v_post_id is null then
    insert into public.posts (user_id, account_id, topic_id, published_at)
    values (v_user_id, v_account_id, p_topic_id, now())
    returning id into v_post_id;
  else
    update public.posts
    set published_at = coalesce(published_at, now())
    where id = v_post_id;
  end if;

  insert into public.asset_usages (
    user_id,
    account_id,
    asset_id,
    topic_id,
    post_id,
    use_type,
    position
  )
  select
    v_user_id,
    v_account_id,
    link.asset_id,
    p_topic_id,
    v_post_id,
    case when row_number() over (order by link.position, link.asset_id) = 1
      then 'cover'::public.asset_use_type
      else 'body'::public.asset_use_type
    end,
    link.position
  from public.topic_assets link
  join public.assets asset on asset.id = link.asset_id
  where link.topic_id = p_topic_id
    and asset.user_id = v_user_id
    and asset.account_id = v_account_id
    and asset.visual_format = 'single'::public.asset_visual_format
    and asset.review_status = 'available'::public.asset_review_status
  on conflict (post_id, asset_id) do nothing;

  update public.topics
  set status = 'published'
  where id = p_topic_id
    and user_id = v_user_id;

  return v_post_id;
end;
$$;

grant execute on function public.mark_topic_published(uuid) to authenticated;
revoke all on function public.mark_topic_published(uuid) from anon;

comment on column public.topics.brief is
  'Structured, human-reviewed content brief used with selected assets for copy generation.';

comment on column public.assets.visual_format is
  'single is eligible for selection; collage/invalid are blocked and uncertain requires review.';

comment on table public.asset_usages is
  'Immutable publication history. Selecting an asset for a draft does not create a usage record.';
