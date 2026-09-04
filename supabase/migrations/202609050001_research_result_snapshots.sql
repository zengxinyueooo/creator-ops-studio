-- Keep the pre-import research inbox across browser refreshes.
-- These rows are review snapshots, not approved reference-note assets.

alter table public.research_tasks
  add column if not exists result_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists last_run_at timestamptz;

comment on column public.research_tasks.result_snapshot is
  'Bounded OpenCLI search results awaiting human selection; references are created only after explicit import.';

comment on column public.research_tasks.last_run_at is
  'Latest successful local browser research run for the task.';
