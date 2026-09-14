-- Keep long-running tasks leased even when they emit no progress events, and
-- prevent a stale worker from overwriting a run reclaimed by another worker.

create or replace function public.renew_agent_run_lease(
  p_run_id uuid,
  p_worker_id text,
  p_step text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agent_runs
  set lease_expires_at = now() + interval '10 minutes',
      current_step = coalesce(p_step, current_step),
      updated_at = now()
  where id = p_run_id
    and status = 'running'
    and worker_id = p_worker_id;

  return found;
end;
$$;

create or replace function public.finish_agent_run(
  p_run_id uuid,
  p_worker_id text,
  p_status text,
  p_error_message text default null,
  p_pi_session_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid terminal agent run status: %', p_status;
  end if;

  update public.agent_runs
  set status = p_status,
      current_step = case when p_status = 'succeeded' then 'completed' else 'failed' end,
      error_message = case when p_status = 'failed' then p_error_message else null end,
      pi_session_id = coalesce(p_pi_session_id, pi_session_id),
      completed_at = now(),
      lease_expires_at = null,
      updated_at = now()
  where id = p_run_id
    and status = 'running'
    and worker_id = p_worker_id;

  return found;
end;
$$;

revoke all on function public.renew_agent_run_lease(uuid, text, text) from public, anon, authenticated;
revoke all on function public.finish_agent_run(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.renew_agent_run_lease(uuid, text, text) to service_role;
grant execute on function public.finish_agent_run(uuid, text, text, text, text) to service_role;
