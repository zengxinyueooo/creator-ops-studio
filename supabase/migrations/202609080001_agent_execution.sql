-- Durable queue/run ledger for local Pi workers. Business workflow state remains
-- in research_tasks; these two tables describe execution only.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  research_task_id uuid not null references public.research_tasks(id) on delete cascade,
  run_type text not null default 'research_discovery' check (run_type in ('research_discovery')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  current_step text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  pi_session_id text,
  worker_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists agent_runs_queue_idx on public.agent_runs (status, created_at);
create index if not exists agent_runs_research_task_idx on public.agent_runs (research_task_id, created_at desc);

create table if not exists public.agent_run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  step text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_run_events_run_idx on public.agent_run_events (run_id, id);

alter table public.agent_runs enable row level security;
alter table public.agent_run_events enable row level security;

create policy "Owners can read agent runs" on public.agent_runs for select
  using (auth.uid() = user_id);

create policy "Owners can enqueue research runs" on public.agent_runs for insert
  with check (
    auth.uid() = user_id
    and status = 'queued'
    and exists (
      select 1 from public.research_tasks task
      where task.id = research_task_id and task.user_id = auth.uid() and task.account_id = agent_runs.account_id
    )
  );

create policy "Owners can read agent run events" on public.agent_run_events for select
  using (auth.uid() = user_id);

create or replace function public.claim_next_agent_run(p_worker_id text)
returns setof public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  select id into claimed_id
  from public.agent_runs
  where status = 'queued'
     or (status = 'running' and lease_expires_at < now())
  order by created_at
  for update skip locked
  limit 1;

  if claimed_id is null then return; end if;

  return query
  update public.agent_runs
  set status = 'running', current_step = 'starting', worker_id = p_worker_id,
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      lease_expires_at = now() + interval '10 minutes', updated_at = now(), error_message = null
  where id = claimed_id
  returning *;
end;
$$;

revoke all on function public.claim_next_agent_run(text) from public, anon, authenticated;
grant execute on function public.claim_next_agent_run(text) to service_role;

