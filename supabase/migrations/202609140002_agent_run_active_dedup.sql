-- The UI may issue concurrent enqueue requests. Keep at most one active run for
-- the same user, workflow type and business target while allowing later reruns.

create unique index agent_runs_one_active_target_idx
  on public.agent_runs (user_id, run_type, target_type, target_id)
  where status in ('queued', 'running');
