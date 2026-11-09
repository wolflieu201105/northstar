begin;

-- DESTRUCTIVE: discard Northstar application data, retaining Supabase Auth accounts.
-- Review docs/shared-groups-migration.md. Prefer complete reset.sql for current
-- setup. This foundation alone is closed; the old frontend needs later group
-- integration. This does not reset the public/auth schemas.
drop trigger if exists northstar_initialize_auth_profile on auth.users;
drop table if exists public.task_assignments, public.task_assignees, public.task_labels,
  public.comments, public.task_activity, public.tasks, public.team_members, public.labels,
  public.group_invitations, public.group_members, public.groups, public.profiles cascade;
drop table if exists private.legacy_workspaces, private.account_identities cascade;
drop function if exists public.save_task(uuid,jsonb,uuid[],uuid[],timestamptz);
drop function if exists public.set_tasks_updated_at();
drop function if exists private.guard_workspace_record_update();
drop function if exists private.reject_workspace_record_update();
drop function if exists private.validate_active_task_reference();
drop function if exists private.lock_task_for_relationship_delete();
drop function if exists private.capture_task_activity();
drop function if exists private.scope_legacy_workspace();
drop function if exists private.ensure_account_workspace(uuid);
drop function if exists private.guard_profile_write();
drop function if exists private.initialize_auth_profile();
drop function if exists private.initialize_account(uuid);

-- If this is a later reset of the shared model, retire every Phase 13 entry
-- point as well. Otherwise old definer helpers could outlive a closed foundation.
do $$
declare owned_function regprocedure;
begin
  for owned_function in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname in ('create_group','rename_group','transfer_group_ownership','leave_group',
      'remove_group_member','delete_group','lookup_invitation_target','send_group_invitation','respond_group_invitation',
      'revoke_group_invitation','list_group_invitations','save_task','delete_task','save_label','post_comment'))
      or (n.nspname='private' and p.proname in ('current_actor','has_group_access','can_read_profile','can_read_invitation',
      'lock_group','consume_api_budget','guard_task_update','guard_append_only','append_task_event','capture_group_task_activity',
      'snapshot_assignment','capture_group_relation_activity','group_operation','lookup_target','send_invitation',
      'resolve_invitation','invitation_page','task_view','save_group_task','delete_group_task','save_group_label','post_group_comment')) loop
    execute format('drop function if exists %s cascade',owned_function);
  end loop;
end;
$$;
drop table if exists private.api_rate_limits;

-- Phase 12: clean shared-group foundation.
-- New APIs are closed until Phase 13. See docs/shared-groups-migration.md.

create schema if not exists private;
revoke create on schema private from public, anon, authenticated;

-- Retain the project's event-trigger helper but remove obsolete API execution.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default 'Guest',
  avatar_color text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint profiles_username_valid check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_valid check (
    char_length(display_name) between 1 and 80 and display_name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint profiles_color_valid check (avatar_color is null or avatar_color in (
    '#20895b','#166b45','#4f8065','#505a54','#c9892d','#c85058'
  ))
);
create unique index profiles_username_key on public.profiles(lower(username));

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_name text not null,
  owner_membership_active boolean not null default true check (owner_membership_active),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint groups_name_valid check (
    char_length(name) between 1 and 80 and name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint groups_creator_name_valid check (char_length(created_by_name) between 1 and 80)
);
create index groups_owner_idx on public.groups(owner_user_id, id);
create index groups_creator_idx on public.groups(created_by_user_id);
create index groups_owner_membership_idx on public.groups(id, owner_user_id, owner_membership_active);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  primary key (group_id, user_id),
  constraint group_members_active_key unique (group_id, user_id, is_active),
  constraint group_members_state_valid check (
    is_active = (left_at is null) and (left_at is null or left_at >= joined_at)
  )
);
create index group_members_user_idx on public.group_members(user_id, group_id);
create index group_members_inviter_idx on public.group_members(invited_by_user_id);

-- Deferral permits one transaction to create a group and its owner membership.
-- The constant true flag makes inactive or missing ownership fail at COMMIT.
alter table public.groups add constraint groups_active_owner_fkey
  foreign key (id, owner_user_id, owner_membership_active)
  references public.group_members(group_id, user_id, is_active)
  deferrable initially deferred;

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_user_id uuid,
  inviter_name text not null,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  responded_at timestamptz,
  constraint group_invitations_sender_fkey foreign key (group_id, inviter_user_id)
    references public.group_members(group_id, user_id) on delete set null (inviter_user_id),
  constraint group_invitations_not_self check (inviter_user_id <> recipient_user_id),
  constraint group_invitations_inviter_name_valid check (char_length(inviter_name) between 1 and 80),
  constraint group_invitations_status_valid check (
    status in ('pending','accepted','declined','revoked','expired')
  ),
  constraint group_invitations_times_valid check (
    expires_at > created_at and (responded_at is null or responded_at >= created_at)
    and ((status = 'pending') = (responded_at is null))
  )
);
create unique index group_invitations_pending_key
  on public.group_invitations(group_id, recipient_user_id) where status = 'pending';
create index group_invitations_inbox_idx
  on public.group_invitations(recipient_user_id, created_at desc, id);
create index group_invitations_sender_idx
  on public.group_invitations(group_id, inviter_user_id, created_at desc, id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'normal',
  due_date date,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tasks_group_id_id_key unique (group_id, id),
  constraint tasks_title_valid check (
    char_length(title) between 1 and 160 and title = btrim(title)
  ),
  constraint tasks_description_valid check (description is null or char_length(description) <= 1000),
  constraint tasks_status_valid check (status in ('todo','in_progress','in_review','done')),
  constraint tasks_priority_valid check (priority in ('low','normal','high')),
  constraint tasks_creator_name_valid check (char_length(created_by_name) between 1 and 80)
);
create index tasks_group_created_idx on public.tasks(group_id, created_at desc, id);
create index tasks_creator_idx on public.tasks(created_by_user_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  color text not null default '#20895b',
  archived_at timestamptz,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint labels_group_id_id_key unique (group_id, id),
  constraint labels_name_valid check (
    char_length(name) between 1 and 40 and name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint labels_color_valid check (color in (
    '#20895b','#166b45','#4f8065','#505a54','#c9892d','#c85058'
  ))
);
create unique index labels_group_name_key on public.labels(group_id, lower(name));
create index labels_creator_idx on public.labels(created_by_user_id);

create table public.task_assignments (
  group_id uuid not null,
  task_id uuid not null,
  assignee_user_id uuid not null,
  membership_active boolean not null default true check (membership_active),
  assigned_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (group_id, task_id, assignee_user_id),
  constraint task_assignments_task_fkey foreign key (group_id, task_id)
    references public.tasks(group_id, id) on delete cascade,
  constraint task_assignments_active_member_fkey foreign key (group_id, assignee_user_id, membership_active)
    references public.group_members(group_id, user_id, is_active) on delete cascade
);
create index task_assignments_member_idx on public.task_assignments(group_id, assignee_user_id, membership_active);
create index task_assignments_actor_idx on public.task_assignments(assigned_by_user_id);

create table public.task_labels (
  group_id uuid not null,
  task_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (group_id, task_id, label_id),
  constraint task_labels_task_fkey foreign key (group_id, task_id)
    references public.tasks(group_id, id) on delete cascade,
  constraint task_labels_label_fkey foreign key (group_id, label_id)
    references public.labels(group_id, id) on delete cascade
);
create index task_labels_label_idx on public.task_labels(group_id, label_id, task_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  task_id uuid not null,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint comments_task_fkey foreign key (group_id, task_id)
    references public.tasks(group_id, id) on delete cascade,
  constraint comments_body_valid check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  constraint comments_author_name_valid check (char_length(author_name) between 1 and 80)
);
create index comments_group_task_created_idx on public.comments(group_id, task_id, created_at, id);
create index comments_author_idx on public.comments(author_user_id);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  task_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint task_activity_task_fkey foreign key (group_id, task_id)
    references public.tasks(group_id, id) on delete cascade,
  constraint task_activity_event_type_valid check (event_type in (
    'task_created','status_changed','task_edited','assignee_added','assignee_removed','label_added','label_removed'
  )),
  constraint task_activity_payload_valid check (jsonb_typeof(payload) = 'object'),
  constraint task_activity_actor_name_valid check (char_length(actor_name) between 1 and 80)
);
create index task_activity_group_task_created_idx on public.task_activity(group_id, task_id, created_at, id);
create index task_activity_actor_idx on public.task_activity(actor_user_id);

-- Explicitly close every new table, including projects with permissive defaults.
-- Do not attach old owner policies or old task RPCs to this group schema.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','groups','group_members','group_invitations',
    'tasks','labels','task_assignments','task_labels','comments','task_activity'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

create or replace function private.guard_profile_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.username := lower(btrim(new.username));
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'Profile identity and creation time cannot change.' using errcode = '42501';
    end if;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_write() from public, anon, authenticated, service_role;
create trigger guard_profile_write before insert or update on public.profiles
  for each row execute function private.guard_profile_write();

-- Trigger-only initializer. This creates an actual Auth user's profile, never
-- credentials or a profile inferred from a free-text assignee name.
create or replace function private.initialize_account(account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  candidate text := 'guest_' || left(replace(account_id::text, '-', ''), 24);
  inserted_id uuid;
  private_group_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where id=account_id) then
    raise exception 'Auth user does not exist.' using errcode = '23503';
  end if;
  loop
    begin
      insert into public.profiles(id, username) values (account_id, candidate)
        on conflict (id) do nothing returning id into inserted_id;
      exit;
    exception when unique_violation then
      candidate := 'guest_' || left(replace(gen_random_uuid()::text, '-', ''), 24);
    end;
  end loop;
  if inserted_id is null then return; end if;
  insert into public.groups(id,name,owner_user_id,created_by_user_id,created_by_name)
    values (private_group_id,'My workspace',account_id,account_id,'Guest');
  insert into public.group_members(group_id,user_id) values (private_group_id,account_id);
end;
$$;
revoke all on function private.initialize_account(uuid) from public, anon, authenticated, service_role;

create or replace function private.initialize_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_schema <> 'auth' or tg_table_name <> 'users' or tg_op <> 'INSERT' then
    raise exception 'Unsupported Auth trigger.' using errcode = '42501';
  end if;
  perform private.initialize_account(new.id);
  return new;
end;
$$;
revoke all on function private.initialize_auth_profile() from public, anon, authenticated, service_role;
create trigger northstar_initialize_auth_profile after insert on auth.users
  for each row execute function private.initialize_auth_profile();

-- Retain Auth accounts if resetting just application tables. Never copy tasks,
-- placeholder assignees, old labels, comments, or activity into this fresh model.
do $$
declare account_id uuid;
begin
  for account_id in select id from auth.users order by id loop
    perform private.initialize_account(account_id);
  end loop;
end;
$$;

comment on table public.profiles is 'Real Supabase Auth profiles, including guests. Credentials stay in auth.users.';
comment on table public.groups is 'Shared task groups; owner must remain an active member.';
comment on table public.group_members is 'Accepted active/inactive membership. Pending invitations grant no membership.';
comment on table public.task_assignments is 'Task assignees must be active actual users in the same group.';
comment on table public.task_activity is 'Database-written task history; actor name retained after account deletion.';
comment on column public.comments.author_user_id is 'Nullable after account deletion; author_name retains historical attribution.';

notify pgrst, 'reload schema';
commit;
