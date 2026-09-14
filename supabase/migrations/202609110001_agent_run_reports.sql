-- Derived report, not a second execution queue. Only the worker writes it.
create table public.agent_run_reports (
  run_id uuid primary key references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report jsonb not null,
  generated_at timestamptz not null default now()
);
alter table public.agent_run_reports enable row level security;
create policy "Owners can read execution reports" on public.agent_run_reports
  for select to authenticated using (auth.uid() = user_id);
grant select on public.agent_run_reports to authenticated;
grant all on public.agent_run_reports to service_role;
