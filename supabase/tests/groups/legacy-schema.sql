-- Representative retired tables for reset coverage; no historical migration dependency.
create schema if not exists private;
create table public.team_members(id uuid primary key,user_id uuid default auth.uid(),name text);
create table public.labels(id uuid primary key,user_id uuid default auth.uid(),name text);
create table public.task_assignees(task_id uuid references public.tasks(id) on delete cascade,
  member_id uuid references public.team_members(id) on delete cascade);
create table public.task_labels(task_id uuid references public.tasks(id) on delete cascade,
  label_id uuid references public.labels(id) on delete cascade);
create table public.comments(id uuid default gen_random_uuid(),user_id uuid default auth.uid(),
  task_id uuid references public.tasks(id) on delete cascade,body text);
create table public.task_activity(id uuid default gen_random_uuid(),user_id uuid default auth.uid(),
  task_id uuid references public.tasks(id) on delete cascade,event_type text,payload jsonb);
create function public.save_task(uuid,jsonb,uuid[],uuid[],timestamptz) returns jsonb language sql as $$select '{"retired":true}'::jsonb$$;
