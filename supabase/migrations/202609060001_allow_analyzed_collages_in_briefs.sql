-- A collage is still a valid visual reference.  Format controls display and
-- analysis, while only invalid or non-available assets are excluded from Briefs.
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
      and asset.visual_format <> 'invalid'::public.asset_visual_format
      and asset.review_status = 'available'::public.asset_review_status
  ) then
    raise exception 'Only available, valid visual assets can be selected for a topic';
  end if;
  return new;
end;
$$;

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
      and asset.visual_format <> 'invalid'::public.asset_visual_format
      and asset.review_status = 'available'::public.asset_review_status
  ) then
    raise exception 'Select at least one available visual asset before publishing';
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
    and asset.visual_format <> 'invalid'::public.asset_visual_format
    and asset.review_status = 'available'::public.asset_review_status
  on conflict (post_id, asset_id) do nothing;

  update public.topics
  set status = 'published'
  where id = p_topic_id
    and user_id = v_user_id;

  return v_post_id;
end;
$$;

comment on column public.assets.visual_format is
  'Formatting metadata. Both single and collage assets may be selected when visual analysis marks them available; invalid assets are blocked.';
