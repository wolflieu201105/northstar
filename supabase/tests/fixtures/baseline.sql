-- Frozen pre-enhancement schema for the upgrade regression test only.
-- Northstar task board schema
-- Run this file in the Supabase SQL Editor for the project used by the app.

begin;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'normal',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_title_not_blank
    check (char_length(title) between 1 and 160 and title = btrim(title)),
  constraint tasks_description_length
    check (description is null or char_length(description) <= 1000),
  constraint tasks_status_valid
    check (status in ('todo', 'in_progress', 'in_review', 'done')),
  constraint tasks_priority_valid
    check (priority in ('low', 'normal', 'high'))
);

comment on table public.tasks is
  'Private task-board items owned by Supabase authenticated users, including anonymous guests.';

comment on column public.tasks.user_id is
  'The owning auth.users ID. Anonymous sign-ins also use the authenticated database role.';

create index if not exists tasks_user_created_id_idx
  on public.tasks (user_id, created_at desc, id);

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_tasks_updated_at() from public, anon, authenticated;

drop trigger if exists set_tasks_updated_at on public.tasks;

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_tasks_updated_at();

alter table public.tasks enable row level security;

-- Data API access is opt-in. Anonymous signed-in guests use the authenticated role;
-- unauthenticated clients using only the public key receive no table privileges.
revoke all on table public.tasks from anon, authenticated;

grant select, delete on table public.tasks to authenticated;
grant insert (title, description, status, priority, due_date, user_id)
  on table public.tasks to authenticated;
grant update (title, description, status, priority, due_date)
  on table public.tasks to authenticated;

drop policy if exists "Users can read their own tasks" on public.tasks;
create policy "Users can read their own tasks"
on public.tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own tasks" on public.tasks;
create policy "Users can create their own tasks"
on public.tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
on public.tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
on public.tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
