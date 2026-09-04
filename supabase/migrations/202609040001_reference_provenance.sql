-- Reference provenance: research task -> note -> stored images -> topic.
-- Additive and backward-compatible; legacy references.topic_id is retained.

alter table public.references
  add column if not exists research_task_id uuid references public.research_tasks(id) on delete set null,
  add column if not exists matched_keyword text,
  add column if not exists discovery_rank smallint check (discovery_rank is null or discovery_rank > 0),
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists reviewed_at timestamptz,
  add column if not exists detail_captured_at timestamptz,
  add column if not exists detail_error text not null default '';

alter table public.assets
  add column if not exists source_reference_id uuid references public.references(id) on delete set null,
  add column if not exists source_position smallint check (source_position is null or source_position >= 1);

create table if not exists public.topic_references (
  topic_id uuid not null references public.topics(id) on delete cascade,
  reference_id uuid not null references public.references(id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  is_primary boolean not null default false,
  link_source text not null default 'manual'
    check (link_source in ('manual', 'workflow', 'legacy_topic_id', 'migration')),
  created_at timestamptz not null default now(),
  primary key (topic_id, reference_id)
);

create index if not exists references_research_task_idx
  on public.references(research_task_id)
  where research_task_id is not null;

create index if not exists references_review_detail_idx
  on public.references(account_id, review_status, detail_status, captured_at desc);

create index if not exists assets_source_reference_position_idx
  on public.assets(source_reference_id, source_position)
  where source_reference_id is not null;

create index if not exists topic_references_reference_idx
  on public.topic_references(reference_id, created_at desc);

create or replace function public.validate_reference_research_task_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.research_task_id is not null and not exists (
    select 1
    from public.research_tasks task
    where task.id = new.research_task_id
      and task.user_id = new.user_id
      and task.account_id = new.account_id
      and (
        new.comic_id is null
        or task.comic_id is null
        or task.comic_id = new.comic_id
      )
  ) then
    raise exception 'research_task_id must belong to the same user, account, and comic';
  end if;
  return new;
end;
$$;

drop trigger if exists references_validate_research_task_link on public.references;
create trigger references_validate_research_task_link
  before insert or update of research_task_id, comic_id, user_id, account_id
  on public.references
  for each row execute function public.validate_reference_research_task_link();

create or replace function public.validate_asset_source_reference_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_reference_id is not null and not exists (
    select 1
    from public.references reference
    where reference.id = new.source_reference_id
      and reference.user_id = new.user_id
      and reference.account_id = new.account_id
      and (
        new.comic_id is null
        or reference.comic_id is null
        or reference.comic_id = new.comic_id
      )
  ) then
    raise exception 'source_reference_id must belong to the same user, account, and comic';
  end if;
  return new;
end;
$$;

drop trigger if exists assets_validate_source_reference_link on public.assets;
create trigger assets_validate_source_reference_link
  before insert or update of source_reference_id, comic_id, user_id, account_id
  on public.assets
  for each row execute function public.validate_asset_source_reference_link();

create or replace function public.validate_topic_reference_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.topics topic
    join public.references reference on reference.id = new.reference_id
    where topic.id = new.topic_id
      and topic.user_id = reference.user_id
      and topic.account_id = reference.account_id
      and (
        topic.comic_id is null
        or reference.comic_id is null
        or topic.comic_id = reference.comic_id
      )
  ) then
    raise exception 'topic and reference must belong to the same user, account, and comic';
  end if;
  return new;
end;
$$;

drop trigger if exists topic_references_validate_link on public.topic_references;
create trigger topic_references_validate_link
  before insert or update of topic_id, reference_id
  on public.topic_references
  for each row execute function public.validate_topic_reference_link();

create or replace function public.stamp_reference_trace_times()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.review_status <> 'candidate' and new.reviewed_at is null then
      new.reviewed_at = now();
    end if;
    if new.detail_status = 'detailed' and new.detail_captured_at is null then
      new.detail_captured_at = now();
    end if;
    return new;
  end if;

  if new.review_status is distinct from old.review_status then
    if new.review_status = 'candidate' then
      new.reviewed_at = null;
    else
      new.reviewed_at = now();
    end if;
  end if;

  if new.detail_status = 'detailed'
    and new.detail_status is distinct from old.detail_status then
    new.detail_captured_at = now();
    new.detail_error = '';
  end if;

  return new;
end;
$$;

drop trigger if exists references_stamp_trace_times on public.references;
create trigger references_stamp_trace_times
  before insert or update of review_status, detail_status
  on public.references
  for each row execute function public.stamp_reference_trace_times();

alter table public.topic_references enable row level security;

drop policy if exists topic_references_owner_all on public.topic_references;
create policy topic_references_owner_all on public.topic_references
  for all to authenticated
  using (
    exists (
      select 1
      from public.topics topic
      join public.references reference
        on reference.id = topic_references.reference_id
      where topic.id = topic_references.topic_id
        and topic.user_id = auth.uid()
        and reference.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.topics topic
      join public.references reference
        on reference.id = topic_references.reference_id
      where topic.id = topic_references.topic_id
        and topic.user_id = auth.uid()
        and reference.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.topic_references to authenticated;
revoke all on public.topic_references from anon;

-- Preserve the relationships already stored by the v1 schema.
insert into public.topic_references (
  topic_id,
  reference_id,
  position,
  is_primary,
  link_source
)
select
  reference.topic_id,
  reference.id,
  0,
  true,
  'migration'
from public.references reference
where reference.topic_id is not null
on conflict (topic_id, reference_id) do nothing;

-- Link previously stored assets when their source URL exactly matches a note.
update public.assets asset
set source_reference_id = reference.id
from public.references reference
where asset.source_reference_id is null
  and asset.source_url is not null
  and asset.source_url = reference.source_url
  and asset.user_id = reference.user_id
  and asset.account_id = reference.account_id
  and (
    asset.comic_id is null
    or reference.comic_id is null
    or asset.comic_id = reference.comic_id
  );

-- Transitional compatibility: current app versions still write references.topic_id.
create or replace function public.sync_legacy_reference_topic_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.topic_id is not null then
    insert into public.topic_references (
      topic_id,
      reference_id,
      position,
      is_primary,
      link_source
    )
    values (
      new.topic_id,
      new.id,
      0,
      true,
      'legacy_topic_id'
    )
    on conflict (topic_id, reference_id) do update
      set is_primary = excluded.is_primary;
  end if;
  return new;
end;
$$;

drop trigger if exists references_sync_legacy_topic_link on public.references;
create trigger references_sync_legacy_topic_link
  after insert or update of topic_id
  on public.references
  for each row execute function public.sync_legacy_reference_topic_link();

comment on column public.references.research_task_id is
  'Research batch that discovered this note; nullable for legacy/manual records.';

comment on column public.references.hashtags is
  'Hashtags captured from the full Xiaohongshu note detail.';

comment on column public.references.topic_id is
  'Legacy single-topic link. New code should use topic_references.';

comment on column public.assets.source_reference_id is
  'Reference note from which this stored image was collected.';

comment on column public.assets.source_position is
  'One-based image position in the source note.';

comment on table public.topic_references is
  'Many-to-many provenance links between content topics and source notes.';
