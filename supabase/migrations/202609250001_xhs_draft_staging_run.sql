-- User-triggered creator-center draft staging uses the same durable Agent queue.
begin;
alter table public.agent_runs drop constraint if exists agent_runs_run_type_check;
alter table public.agent_runs add constraint agent_runs_run_type_check check (run_type in (
  'comic_profile_enrichment', 'research_discovery', 'note_capture',
  'topic_synthesis', 'brief_generation', 'draft_generation', 'xhs_draft_staging'
));

drop policy if exists "Owners can enqueue agent runs" on public.agent_runs;
create policy "Owners can enqueue agent runs" on public.agent_runs for insert
  with check (
    auth.uid() = user_id and status = 'queued'
    and exists (select 1 from public.accounts account where account.id = account_id and account.user_id = auth.uid())
    and (
      (run_type = 'research_discovery' and target_type = 'research_task' and research_task_id = target_id
        and exists (select 1 from public.research_tasks task where task.id = target_id and task.user_id = auth.uid() and task.account_id = agent_runs.account_id))
      or (run_type = 'comic_profile_enrichment' and target_type = 'comic'
        and exists (select 1 from public.comics comic where comic.id = target_id and comic.user_id = auth.uid() and comic.account_id = agent_runs.account_id))
      or (run_type = 'note_capture' and target_type = 'reference'
        and exists (select 1 from public.references ref where ref.id = target_id and ref.user_id = auth.uid() and ref.account_id = agent_runs.account_id))
      or (run_type = 'topic_synthesis' and target_type = 'reference_set'
        and jsonb_typeof(input -> 'referenceIds') = 'array'
        and jsonb_array_length(input -> 'referenceIds') between 1 and 4
        and not exists (
          select 1 from jsonb_array_elements_text(input -> 'referenceIds') selected(reference_id)
          left join public.references ref on ref.id::text = selected.reference_id and ref.user_id = auth.uid() and ref.account_id = agent_runs.account_id
          where ref.id is null
        ))
      or (run_type in ('brief_generation', 'draft_generation') and target_type = 'topic'
        and exists (select 1 from public.topics topic where topic.id = target_id and topic.user_id = auth.uid() and topic.account_id = agent_runs.account_id))
      or (run_type = 'xhs_draft_staging' and target_type = 'topic'
        and input ? 'draftId' and jsonb_typeof(input -> 'draftId') = 'string'
        and exists (
          select 1 from public.drafts draft
          where draft.id::text = input ->> 'draftId' and draft.topic_id = target_id
            and draft.user_id = auth.uid() and draft.account_id = agent_runs.account_id
        ))
    )
  );
commit;
