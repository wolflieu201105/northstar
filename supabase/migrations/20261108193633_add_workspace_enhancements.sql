-- Additive upgrade for an existing Northstar tasks database.
-- Checkpoint 2: review only; guest access is completed in Phase 3.
begin;

-- Phase 2: additive workspace data model.
-- New tables remain closed to API roles until Phase 3 supplies policies/grants.
-- This block must be identical in schema.sql and the upgrade migration.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_user_id_id_key'
  ) then
    alter table public.tasks
      add constraint tasks_user_id_id_key unique (user_id, id);
  end if;
end;
$$;

create schema if not exists private;
revoke create on schema private from public, anon, authenticated;

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  avatar_color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_members_user_id_id_key unique (user_id, id),
  constraint team_members_name_valid check (
    char_length(name) between 1 and 80
    and name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint team_members_avatar_color_valid check (
    avatar_color is null or avatar_color in (
      '#20895b', '#166b45', '#4f8065', '#505a54', '#c9892d', '#c85058'
    )
  )
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#20895b',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint labels_user_id_id_key unique (user_id, id),
  constraint labels_name_valid check (
    char_length(name) between 1 and 40
    and name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint labels_color_valid check (
    color in ('#20895b', '#166b45', '#4f8065', '#505a54', '#c9892d', '#c85058')
  )
);

-- Archived labels keep their names reserved; the UI will offer Restore.
create unique index if not exists labels_user_normalized_name_key
  on public.labels (user_id, lower(name));

create table if not exists public.task_assignees (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  task_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),

  constraint task_assignees_pkey primary key (user_id, task_id, member_id),
  constraint task_assignees_task_owner_fkey foreign key (user_id, task_id)
    references public.tasks (user_id, id) on delete cascade,
  constraint task_assignees_member_owner_fkey foreign key (user_id, member_id)
    references public.team_members (user_id, id) on delete cascade
);

create index if not exists task_assignees_user_member_task_idx
  on public.task_assignees (user_id, member_id, task_id);

create table if not exists public.task_labels (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  task_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),

  constraint task_labels_pkey primary key (user_id, task_id, label_id),
  constraint task_labels_task_owner_fkey foreign key (user_id, task_id)
    references public.tasks (user_id, id) on delete cascade,
  constraint task_labels_label_owner_fkey foreign key (user_id, label_id)
    references public.labels (user_id, id) on delete cascade
);

create index if not exists task_labels_user_label_task_idx
  on public.task_labels (user_id, label_id, task_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  task_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),

  constraint comments_body_valid check (
    char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'
  ),
  constraint comments_task_owner_fkey foreign key (user_id, task_id)
    references public.tasks (user_id, id) on delete cascade
);

create index if not exists comments_user_task_created_id_idx
  on public.comments (user_id, task_id, created_at, id);

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  task_id uuid not null,
  actor_user_id uuid not null default auth.uid(),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  -- In a guest-owned workspace the actor is its owner, not an assignee profile.
  -- The owning-user foreign key also guarantees this equal actor exists.
  constraint task_activity_actor_is_owner check (actor_user_id = user_id),
  constraint task_activity_event_type_valid check (
    event_type in (
      'task_created', 'status_changed', 'task_edited',
      'assignee_added', 'assignee_removed', 'label_added', 'label_removed'
    )
  ),
  constraint task_activity_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint task_activity_task_owner_fkey foreign key (user_id, task_id)
    references public.tasks (user_id, id) on delete cascade
);

create index if not exists task_activity_user_task_created_id_idx
  on public.task_activity (user_id, task_id, created_at, id);

-- No task rows are updated and no historic events or placeholder profiles are seeded.

comment on table public.team_members is
  'Guest-owned assignment profiles. These records do not grant shared workspace access.';
comment on table public.labels is
  'Guest-owned task labels; names remain unique even after archival.';
comment on table public.task_assignees is
  'Multiple assignee profiles per task; both parents must have the same owner.';
comment on table public.task_labels is
  'Multiple labels per task; both parents must have the same owner.';
comment on table public.comments is
  'Plain-text guest comments; append-only for this version and removed with their task.';
comment on table public.task_activity is
  'Task history. Phase 3 adds trusted event capture; direct guest writes remain disabled.';

-- Prevent ownership/identity changes even through a mistakenly broadened update grant.
create or replace function private.guard_workspace_record_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Record identity, ownership, and creation time cannot be changed.'
      using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.guard_workspace_record_update()
  from public, anon, authenticated, service_role;

drop trigger if exists guard_team_members_update on public.team_members;
create trigger guard_team_members_update
before update on public.team_members
for each row execute function private.guard_workspace_record_update();

drop trigger if exists guard_labels_update on public.labels;
create trigger guard_labels_update
before update on public.labels
for each row execute function private.guard_workspace_record_update();

-- Relationship keys and append-only records have no supported in-place update.
-- Deletion remains possible for parent cascades; Phase 3 controls client DELETE grants.
create or replace function private.reject_workspace_record_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'This record cannot be updated in place.'
    using errcode = '42501';
end;
$$;

revoke all on function private.reject_workspace_record_update()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_task_assignees_update on public.task_assignees;
create trigger reject_task_assignees_update
before update on public.task_assignees
for each row execute function private.reject_workspace_record_update();

drop trigger if exists reject_task_labels_update on public.task_labels;
create trigger reject_task_labels_update
before update on public.task_labels
for each row execute function private.reject_workspace_record_update();

drop trigger if exists reject_comments_update on public.comments;
create trigger reject_comments_update
before update on public.comments
for each row execute function private.reject_workspace_record_update();

drop trigger if exists reject_task_activity_update on public.task_activity;
create trigger reject_task_activity_update
before update on public.task_activity
for each row execute function private.reject_workspace_record_update();

-- Lock the referenced profile/label against concurrent archival until INSERT commits.
-- Existing links survive archival. Both composite foreign keys still enforce ownership.
create or replace function private.validate_active_task_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  referenced_archived_at timestamptz;
begin
  if tg_table_schema = 'public' and tg_table_name = 'task_assignees' then
    select member.archived_at into referenced_archived_at
    from public.team_members as member
    where member.user_id = new.user_id and member.id = new.member_id
    for share;

    if not found then
      raise exception 'Assignee does not belong to this workspace.'
        using errcode = '23503';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'task_labels' then
    select label.archived_at into referenced_archived_at
    from public.labels as label
    where label.user_id = new.user_id and label.id = new.label_id
    for share;

    if not found then
      raise exception 'Label does not belong to this workspace.'
        using errcode = '23503';
    end if;
  else
    raise exception 'Unsupported relationship trigger.' using errcode = '42501';
  end if;

  if referenced_archived_at is not null then
    raise exception 'Archived members and labels cannot be added to a task.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_active_task_reference()
  from public, anon, authenticated, service_role;

drop trigger if exists validate_active_assignee on public.task_assignees;
create trigger validate_active_assignee
before insert on public.task_assignees
for each row execute function private.validate_active_task_reference();

drop trigger if exists validate_active_label on public.task_labels;
create trigger validate_active_label
before insert on public.task_labels
for each row execute function private.validate_active_task_reference();

-- Secure at creation, including projects whose default privileges expose new tables.
-- Phase 3 adds owner policies and the exact supported column grants.
alter table public.team_members enable row level security;
alter table public.labels enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.comments enable row level security;
alter table public.task_activity enable row level security;

revoke all on table
  public.team_members, public.labels, public.task_assignees,
  public.task_labels, public.comments, public.task_activity
from public, anon, authenticated;

commit;
