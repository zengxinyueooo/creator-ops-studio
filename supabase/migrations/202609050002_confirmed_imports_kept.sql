-- “确认导入” is an explicit human approval, so imported reference notes are kept.
-- Preserve manually created candidate references that are unrelated to an imported task.

update public.references reference
set review_status = 'kept'
from public.research_tasks task
where reference.research_task_id = task.id
  and task.status = 'imported'
  and reference.review_status = 'candidate';
