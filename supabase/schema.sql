-- Complete Northstar schema for a new Supabase project. Do not run over an existing application schema.
begin;

-- Shared-group tables and integrity constraints.
-- Read and write access is configured later in this file. See README.md for setup.

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

-- Secure shared-group operations.
-- Membership helpers and the serialized mutation boundary.
create table if not exists private.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key(user_id,bucket,window_start)
);
alter table private.api_rate_limits enable row level security;
revoke all on private.api_rate_limits from public, anon, authenticated, service_role;

create or replace function private.current_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor) then
    raise exception 'A current account is required.' using errcode='42501';
  end if;
  return actor;
end;
$$;

create or replace function private.has_group_access(target_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(
    select 1 from public.group_members m join public.profiles p on p.id=m.user_id
    where m.group_id=target_group and m.user_id=auth.uid() and m.is_active
  );
$$;

create or replace function private.can_read_profile(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid())
    and (target_user=auth.uid() or exists(
      select 1 from public.group_members mine join public.group_members theirs on theirs.group_id=mine.group_id
      where mine.user_id=auth.uid() and mine.is_active and theirs.user_id=target_user
    ));
$$;

create or replace function private.can_read_invitation(target_group uuid, sender uuid, recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid())
    and (recipient=auth.uid() or (private.has_group_access(target_group)
      and (sender=auth.uid() or exists(select 1 from public.groups where id=target_group and owner_user_id=auth.uid()))));
$$;

-- Every group mutation takes this parent lock BEFORE task/member/invite locks.
-- Small-group writes serialize, including edits versus removal and accept/revoke.
create or replace function private.lock_group(target_group uuid, owner_only boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_actor(); group_owner uuid;
begin
  select owner_user_id into group_owner from public.groups where id=target_group for update;
  if not found or not private.has_group_access(target_group) or (owner_only and group_owner<>actor) then
    raise exception 'Group is unavailable or this action is not allowed.' using errcode='42501';
  end if;
  return actor;
end;
$$;

create or replace function private.consume_api_budget(action_name text, allowed integer, period interval)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_actor(); start_time timestamptz; used integer;
begin
  -- A fixed UTC origin prevents a request/session timezone from shifting quotas.
  start_time := date_bin(period,clock_timestamp(),'2000-01-01 00:00:00+00'::timestamptz);
  delete from private.api_rate_limits where user_id=actor and bucket=action_name and window_start<start_time;
  insert into private.api_rate_limits(user_id,bucket,window_start,hits) values(actor,action_name,start_time,1)
    on conflict(user_id,bucket,window_start) do update set hits=private.api_rate_limits.hits+1 returning hits into used;
  if used>allowed then raise exception 'Too many requests. Try again later.' using errcode='54000'; end if;
end;
$$;

revoke all on function private.current_actor(), private.has_group_access(uuid), private.can_read_profile(uuid),
  private.can_read_invitation(uuid,uuid,uuid), private.lock_group(uuid,boolean),
  private.consume_api_budget(text,integer,interval) from public, anon, authenticated, service_role;

-- Only these predicates are client-callable; they reveal the caller's own access.
grant usage on schema private to authenticated;
grant execute on function private.has_group_access(uuid), private.can_read_profile(uuid),
  private.can_read_invitation(uuid,uuid,uuid) to authenticated;

-- Real names are saved at assignment time for account-deletion cleanup.
alter table public.task_assignments add column if not exists assignee_name text;
alter table public.task_assignments add column if not exists assignee_avatar_color text;
update public.task_assignments a set assignee_name=p.display_name,assignee_avatar_color=p.avatar_color
  from public.profiles p where p.id=a.assignee_user_id and a.assignee_name is null;
alter table public.task_assignments alter column assignee_name set not null;

create or replace function private.guard_task_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Only FK cleanup may clear a deleted creator; retain the exact task token.
  if old.created_by_user_id is not null and new.created_by_user_id is null
    and (to_jsonb(new)-'created_by_user_id')=(to_jsonb(old)-'created_by_user_id')
    and not exists(select 1 from auth.users where id=old.created_by_user_id) then return new; end if;
  if new.id is distinct from old.id or new.group_id is distinct from old.group_id
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_by_name is distinct from old.created_by_name or new.created_at is distinct from old.created_at then
    raise exception 'Task identity and attribution are immutable.' using errcode='42501';
  end if;
  new.updated_at := greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists guard_task_update on public.tasks;
create trigger guard_task_update before update on public.tasks for each row execute function private.guard_task_update();

create or replace function private.guard_append_only()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare reference_column text := case tg_table_name when 'comments' then 'author_user_id' else 'actor_user_id' end;
begin
  if (to_jsonb(old)->>reference_column) is not null
    and (to_jsonb(new)->>reference_column) is null
    and (to_jsonb(new)-reference_column)=(to_jsonb(old)-reference_column)
    and not exists(select 1 from auth.users where id=(to_jsonb(old)->>reference_column)::uuid) then return new; end if;
  raise exception 'Discussion records are append-only.' using errcode='42501';
end;
$$;
drop trigger if exists guard_comment_update on public.comments;
create trigger guard_comment_update before update on public.comments for each row execute function private.guard_append_only();
drop trigger if exists guard_activity_update on public.task_activity;
create trigger guard_activity_update before update on public.task_activity for each row execute function private.guard_append_only();

create or replace function private.append_task_event(target_group uuid,target_task uuid,event_name text,event_payload jsonb,system_event boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_display text;
begin
  if system_event then actor:=null; actor_display:='System';
  else
    actor:=private.current_actor();
    if not private.has_group_access(target_group) then raise exception 'Group is unavailable.' using errcode='42501'; end if;
    select display_name into actor_display from public.profiles where id=actor;
  end if;
  insert into public.task_activity(group_id,task_id,actor_user_id,actor_name,event_type,payload)
    values(target_group,target_task,actor,actor_display,event_name,event_payload);
end;
$$;

create or replace function private.capture_group_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changes jsonb:='{}'; field_name text;
begin
  if tg_table_schema<>'public' or tg_table_name<>'tasks' or tg_when<>'AFTER' then
    raise exception 'Unsupported activity source.' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    perform private.append_task_event(new.group_id,new.id,'task_created',jsonb_build_object('version',2,'title',new.title,'status',new.status));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform private.append_task_event(new.group_id,new.id,'status_changed',jsonb_build_object('version',2,'from',old.status,'to',new.status));
  end if;
  foreach field_name in array array['title','description','priority','due_date'] loop
    if (to_jsonb(new)->field_name) is distinct from (to_jsonb(old)->field_name) then
      changes:=changes||jsonb_build_object(field_name,jsonb_build_object('from',to_jsonb(old)->field_name,'to',to_jsonb(new)->field_name));
    end if;
  end loop;
  if changes<>'{}'::jsonb then perform private.append_task_event(new.group_id,new.id,'task_edited',jsonb_build_object('version',2,'changes',changes)); end if;
  return new;
end;
$$;
drop trigger if exists capture_group_task_activity on public.tasks;
create trigger capture_group_task_activity after insert or update on public.tasks
  for each row execute function private.capture_group_task_activity();

create or replace function private.snapshot_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select display_name,avatar_color into new.assignee_name,new.assignee_avatar_color
    from public.profiles where id=new.assignee_user_id;
  return new;
end;
$$;
drop trigger if exists snapshot_assignment on public.task_assignments;
create trigger snapshot_assignment before insert on public.task_assignments for each row execute function private.snapshot_assignment();

create or replace function private.capture_group_relation_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; target_group uuid; target_task uuid; related_id uuid;
  related_name text; related_color text; event_name text; payload jsonb; system_event boolean:=false;
begin
  if tg_table_schema<>'public' or tg_table_name not in ('task_assignments','task_labels') or tg_when<>'AFTER' then
    raise exception 'Unsupported relationship source.' using errcode='42501';
  end if;
  row_data:=case when tg_op='INSERT' then to_jsonb(new) else to_jsonb(old) end;
  target_group:=(row_data->>'group_id')::uuid; target_task:=(row_data->>'task_id')::uuid;
  -- Cascading group/task deletion has no surviving timeline.
  if not exists(select 1 from public.groups where id=target_group) then return null; end if;
  perform 1 from public.tasks where id=target_task and group_id=target_group for update;
  if not found then return null; end if;
  if tg_table_name='task_assignments' then
    related_id:=(row_data->>'assignee_user_id')::uuid;
    select display_name,avatar_color into related_name,related_color from public.profiles where id=related_id;
    -- AFTER events from FK cascades may be queued at trigger depth 1. The
    -- missing Auth parent, not nesting depth, proves account cleanup here.
    system_event:=tg_op='DELETE' and not exists(select 1 from auth.users where id=related_id);
    related_name:=coalesce(related_name,row_data->>'assignee_name','Deleted member');
    related_color:=coalesce(related_color,row_data->>'assignee_avatar_color');
    event_name:=case when tg_op='INSERT' then 'assignee_added' else 'assignee_removed' end;
    payload:=jsonb_build_object('version',2,'assignee_user_id',related_id,'assignee_name',related_name,'avatar_color',related_color);
  else
    related_id:=(row_data->>'label_id')::uuid;
    select name,color into related_name,related_color from public.labels where id=related_id and group_id=target_group;
    event_name:=case when tg_op='INSERT' then 'label_added' else 'label_removed' end;
    payload:=jsonb_build_object('version',2,'label_id',related_id,'label_name',coalesce(related_name,'Deleted label'),'color',related_color);
  end if;
  perform private.append_task_event(target_group,target_task,event_name,payload,system_event);
  update public.tasks set updated_at=clock_timestamp() where id=target_task and group_id=target_group;
  return null;
end;
$$;
drop trigger if exists capture_group_assignment on public.task_assignments;
create trigger capture_group_assignment after insert or delete on public.task_assignments for each row execute function private.capture_group_relation_activity();
drop trigger if exists capture_group_label on public.task_labels;
create trigger capture_group_label after insert or delete on public.task_labels for each row execute function private.capture_group_relation_activity();

revoke all on function private.guard_task_update(),private.guard_append_only(),
  private.append_task_event(uuid,uuid,text,jsonb,boolean),private.capture_group_task_activity(),
  private.snapshot_assignment(),private.capture_group_relation_activity() from public,anon,authenticated,service_role;

create or replace function private.group_operation(action_name text,target_group uuid,input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.current_actor(); group_row public.groups; target_user uuid; actor_display text;
begin
  if action_name='create' then
    select * into group_row from public.groups where id=target_group for update;
    if found then
      if not private.has_group_access(target_group) then raise exception 'Group is unavailable.' using errcode='42501'; end if;
      return to_jsonb(group_row);
    end if;
    select display_name into actor_display from public.profiles where id=actor;
    insert into public.groups(id,name,owner_user_id,created_by_user_id,created_by_name)
      values(target_group,btrim(input->>'name'),actor,actor,actor_display) returning * into group_row;
    insert into public.group_members(group_id,user_id) values(target_group,actor);
    return to_jsonb(group_row);
  end if;
  if action_name is null or action_name not in ('rename','transfer','leave','remove','delete') then
    raise exception 'Unknown group operation.' using errcode='22023';
  end if;
  actor:=private.lock_group(target_group,action_name in ('transfer','remove','delete'));
  select * into group_row from public.groups where id=target_group;
  if action_name='delete' then
    delete from public.groups where id=target_group;
    return jsonb_build_object('group_id',target_group,'deleted',true);
  elsif action_name='rename' then
    update public.groups set name=btrim(input->>'name'),updated_at=clock_timestamp()
      where id=target_group and name is distinct from btrim(input->>'name') returning * into group_row;
    if not found then select * into group_row from public.groups where id=target_group; end if;
    return to_jsonb(group_row);
  elsif action_name='transfer' then
    target_user:=(input->>'user_id')::uuid;
    if not exists(select 1 from public.group_members where group_id=target_group and user_id=target_user and is_active) then
      raise exception 'The new owner must be an active member.' using errcode='22023';
    end if;
    update public.groups set owner_user_id=target_user,updated_at=clock_timestamp()
      where id=target_group returning * into group_row;
    return to_jsonb(group_row);
  end if;
  target_user:=case when action_name='leave' then actor else (input->>'user_id')::uuid end;
  if target_user is null or target_user=group_row.owner_user_id then
    raise exception 'Transfer ownership or delete the group before its owner leaves.' using errcode='22023';
  end if;
  -- Relationship triggers record actual removals BEFORE membership becomes inactive.
  delete from public.task_assignments where group_id=target_group and assignee_user_id=target_user;
  update public.group_invitations set status='revoked',responded_at=clock_timestamp()
    where group_id=target_group and inviter_user_id=target_user and status='pending';
  update public.group_members set is_active=false,left_at=clock_timestamp()
    where group_id=target_group and user_id=target_user and is_active;
  return jsonb_build_object('group_id',target_group,'user_id',target_user,'is_active',false);
end;
$$;

create or replace function private.lookup_target(target_group uuid,query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_uuid uuid; result jsonb; normalized text:=lower(btrim(query));
begin
  perform private.lock_group(target_group);
  perform private.consume_api_budget('account_lookup',30,interval '1 minute');
  if normalized is null or length(normalized)>80 then return null; end if;
  if normalized ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then target_uuid:=normalized::uuid; end if;
  select jsonb_build_object('id',id,'username',username,'display_name',display_name,'avatar_color',avatar_color)
    into result from public.profiles
    where (target_uuid is not null and id=target_uuid) or (target_uuid is null and username=normalized);
  -- Unknown lookups return normally, so they consume budget too.
  return result;
end;
$$;

create or replace function private.send_invitation(target_group uuid,recipient uuid,invitation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.lock_group(target_group); invite public.group_invitations; actor_display text;
begin
  if recipient is null or invitation_id is null or recipient=actor then
    raise exception 'Choose another actual account.' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles where id=recipient) then
    raise exception 'Recipient is unavailable.' using errcode='42501';
  end if;
  if exists(select 1 from public.group_members where group_id=target_group and user_id=recipient and is_active) then
    raise exception 'This account already belongs to the group.' using errcode='22023';
  end if;
  select * into invite from public.group_invitations where id=invitation_id;
  if found then
    if invite.group_id<>target_group or invite.recipient_user_id<>recipient or invite.inviter_user_id is distinct from actor then
      raise exception 'Invitation ID is unavailable.' using errcode='42501';
    end if;
    return to_jsonb(invite);
  end if;
  update public.group_invitations set status='expired',responded_at=clock_timestamp()
    where group_id=target_group and recipient_user_id=recipient and status='pending' and expires_at<=clock_timestamp();
  update public.group_invitations i set status='revoked',responded_at=clock_timestamp()
    where i.group_id=target_group and i.recipient_user_id=recipient and i.status='pending'
      and not exists(select 1 from public.group_members m where m.group_id=i.group_id and m.user_id=i.inviter_user_id and m.is_active);
  select * into invite from public.group_invitations
    where group_id=target_group and recipient_user_id=recipient and status='pending';
  if found then return to_jsonb(invite); end if;
  perform private.consume_api_budget('invitation_send',20,interval '1 hour');
  select display_name into actor_display from public.profiles where id=actor;
  insert into public.group_invitations(id,group_id,inviter_user_id,inviter_name,recipient_user_id)
    values(invitation_id,target_group,actor,actor_display,recipient) returning * into invite;
  return to_jsonb(invite);
end;
$$;

create or replace function private.resolve_invitation(invitation_id uuid,action_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.current_actor(); invite public.group_invitations; owner_id uuid;
begin
  if action_name is null or action_name not in ('accept','decline','revoke') then raise exception 'Unknown invitation action.' using errcode='22023'; end if;
  select * into invite from public.group_invitations where id=invitation_id;
  if not found then raise exception 'Invitation is unavailable.' using errcode='42501'; end if;
  -- Pre-read supplies only a lock key; re-read under the parent lock before acting.
  select owner_user_id into owner_id from public.groups where id=invite.group_id for update;
  if not found then raise exception 'Invitation is unavailable.' using errcode='42501'; end if;
  select * into invite from public.group_invitations where id=invitation_id for update;
  if not found then raise exception 'Invitation is unavailable.' using errcode='42501'; end if;
  if action_name='revoke' then
    if not private.has_group_access(invite.group_id) or (actor is distinct from invite.inviter_user_id and actor<>owner_id) then
      raise exception 'Invitation is unavailable.' using errcode='42501';
    end if;
  elsif invite.recipient_user_id<>actor then raise exception 'Invitation is unavailable.' using errcode='42501';
  end if;
  -- Terminal retries never recreate membership (including after a later removal).
  if invite.status<>'pending' then return to_jsonb(invite); end if;
  if invite.expires_at<=clock_timestamp() then invite.status:='expired';
  elsif action_name='accept' and not exists(select 1 from public.group_members
    where group_id=invite.group_id and user_id=invite.inviter_user_id and is_active) then invite.status:='revoked';
  elsif action_name='accept' then
    insert into public.group_members(group_id,user_id,invited_by_user_id)
      values(invite.group_id,actor,invite.inviter_user_id)
      on conflict(group_id,user_id) do update set is_active=true,left_at=null,
        joined_at=clock_timestamp(),invited_by_user_id=excluded.invited_by_user_id;
    invite.status:='accepted';
  else invite.status:=case when action_name='decline' then 'declined' else 'revoked' end;
  end if;
  update public.group_invitations set status=invite.status,responded_at=clock_timestamp()
    where id=invite.id returning * into invite;
  return to_jsonb(invite);
end;
$$;

create or replace function private.invitation_page(page_size integer,before_time timestamptz,before_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid:=private.current_actor(); result jsonb;
begin
  if page_size is null or page_size not between 1 and 100 or (before_time is null)<>(before_id is null) then
    raise exception 'Invalid invitation cursor or limit.' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb) into result from (
    select i.id,i.group_id,g.name as group_name,i.inviter_user_id,i.inviter_name,i.recipient_user_id,
      case when i.status='pending' and i.expires_at<=clock_timestamp() then 'expired'
        when i.status='pending' and not exists(select 1 from public.group_members m
          where m.group_id=i.group_id and m.user_id=i.inviter_user_id and m.is_active) then 'revoked'
        else i.status end as status,
      i.created_at,i.expires_at,i.responded_at
    from public.group_invitations i join public.groups g on g.id=i.group_id
    where (i.recipient_user_id=actor or (private.has_group_access(i.group_id) and (i.inviter_user_id=actor or g.owner_user_id=actor)))
      and (before_time is null or (i.created_at,i.id)<(before_time,before_id))
    order by i.created_at desc,i.id desc limit page_size
  ) page;
  return result;
end;
$$;

revoke all on function private.group_operation(text,uuid,jsonb),private.lookup_target(uuid,text),
  private.send_invitation(uuid,uuid,uuid),private.resolve_invitation(uuid,text),
  private.invitation_page(integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function private.group_operation(text,uuid,jsonb),private.lookup_target(uuid,text),
  private.send_invitation(uuid,uuid,uuid),private.resolve_invitation(uuid,text),
  private.invitation_page(integer,timestamptz,uuid) to authenticated;

create or replace function private.task_view(target_group uuid,target_task uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(t)||jsonb_build_object(
    'assignees',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,
      'display_name',p.display_name,'avatar_color',p.avatar_color) order by p.display_name,p.id)
      from public.task_assignments a join public.profiles p on p.id=a.assignee_user_id
      where a.group_id=t.group_id and a.task_id=t.id),'[]'::jsonb),
    'labels',coalesce((select jsonb_agg(to_jsonb(l) order by l.name,l.id)
      from public.task_labels a join public.labels l on l.id=a.label_id and l.group_id=a.group_id
      where a.group_id=t.group_id and a.task_id=t.id),'[]'::jsonb))
  from public.tasks t where t.group_id=target_group and t.id=target_task;
$$;

create or replace function private.save_group_task(
  target_group uuid,target_task uuid,changes jsonb,assignee_ids uuid[],label_ids uuid[],expected_token timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.lock_group(target_group); task_row public.tasks; saved public.tasks;
  existing boolean; actor_display text; field_name text; normalized_assignees uuid[]; normalized_labels uuid[];
begin
  if target_task is null or changes is null or jsonb_typeof(changes)<>'object' then
    raise exception 'A task ID and changes object are required.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(changes) key where key not in ('title','description','status','priority','due_date')) then
    raise exception 'Unsupported task field.' using errcode='22023';
  end if;
  foreach field_name in array array['title','description','status','priority','due_date'] loop
    if changes ? field_name and jsonb_typeof(changes->field_name)<>'string'
      and not (field_name in ('description','due_date') and changes->field_name='null'::jsonb) then
      raise exception 'Invalid task field type.' using errcode='22023';
    end if;
  end loop;
  if changes ? 'due_date' and coalesce(changes->>'due_date','')<>''
    and (changes->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Use an ISO calendar date.' using errcode='22023';
  end if;
  select * into task_row from public.tasks where id=target_task and group_id=target_group for update;
  existing:=found;
  if existing and (expected_token is null or expected_token<>task_row.updated_at) then
    raise exception 'This task changed. Reload it before saving.' using errcode='40001';
  elsif not existing and expected_token is not null then
    raise exception 'This task is no longer available.' using errcode='P0002';
  end if;
  if assignee_ids is not null then
    if array_position(assignee_ids,null) is not null then raise exception 'Invalid assignee IDs.' using errcode='22023'; end if;
    select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into normalized_assignees from unnest(assignee_ids) id;
    if exists(select 1 from unnest(normalized_assignees) id where not exists(
      select 1 from public.group_members m where m.group_id=target_group and m.user_id=id and m.is_active
    )) then raise exception 'An assignee is not an active group member.' using errcode='42501'; end if;
  end if;
  if label_ids is not null then
    if array_position(label_ids,null) is not null then raise exception 'Invalid label IDs.' using errcode='22023'; end if;
    select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into normalized_labels from unnest(label_ids) id;
    if exists(select 1 from unnest(normalized_labels) requested where not exists(
      select 1 from public.labels l where l.group_id=target_group and l.id=requested
        and (l.archived_at is null or exists(select 1 from public.task_labels a
          where a.group_id=target_group and a.task_id=target_task and a.label_id=requested))
    )) then raise exception 'A label is unavailable or archived.' using errcode='42501'; end if;
  end if;
  if not existing then
    select display_name into actor_display from public.profiles where id=actor;
    insert into public.tasks(id,group_id,title,description,status,priority,due_date,created_by_user_id,created_by_name)
      values(target_task,target_group,btrim(changes->>'title'),nullif(btrim(changes->>'description'),''),
        coalesce(changes->>'status','todo'),coalesce(changes->>'priority','normal'),
        nullif(changes->>'due_date','')::date,actor,actor_display) returning * into task_row;
  else
    saved:=task_row;
    if changes ? 'title' then saved.title:=btrim(changes->>'title'); end if;
    if changes ? 'description' then saved.description:=nullif(btrim(changes->>'description'),''); end if;
    if changes ? 'status' then saved.status:=changes->>'status'; end if;
    if changes ? 'priority' then saved.priority:=changes->>'priority'; end if;
    if changes ? 'due_date' then saved.due_date:=nullif(changes->>'due_date','')::date; end if;
    if (saved.title,saved.description,saved.status,saved.priority,saved.due_date)
      is distinct from (task_row.title,task_row.description,task_row.status,task_row.priority,task_row.due_date) then
      update public.tasks set title=saved.title,description=saved.description,status=saved.status,
        priority=saved.priority,due_date=saved.due_date where id=target_task and group_id=target_group;
    end if;
  end if;
  if normalized_assignees is not null then
    delete from public.task_assignments where group_id=target_group and task_id=target_task and not(assignee_user_id=any(normalized_assignees));
    insert into public.task_assignments(group_id,task_id,assignee_user_id,assigned_by_user_id)
      select target_group,target_task,id,actor from unnest(normalized_assignees) id
      where not exists(select 1 from public.task_assignments a where a.group_id=target_group and a.task_id=target_task and a.assignee_user_id=id);
  end if;
  if normalized_labels is not null then
    delete from public.task_labels where group_id=target_group and task_id=target_task and not(label_id=any(normalized_labels));
    insert into public.task_labels(group_id,task_id,label_id)
      select target_group,target_task,id from unnest(normalized_labels) id
      where not exists(select 1 from public.task_labels a where a.group_id=target_group and a.task_id=target_task and a.label_id=id);
  end if;
  return private.task_view(target_group,target_task);
end;
$$;

create or replace function private.delete_group_task(target_group uuid,target_task uuid,expected_token timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task_row public.tasks;
begin
  perform private.lock_group(target_group);
  select * into task_row from public.tasks where id=target_task and group_id=target_group for update;
  if found then
    if expected_token is null or expected_token<>task_row.updated_at then
      raise exception 'This task changed. Reload it before deleting.' using errcode='40001';
    end if;
    delete from public.tasks where id=target_task and group_id=target_group;
  end if;
  return jsonb_build_object('task_id',target_task,'deleted',true);
end;
$$;

create or replace function private.save_group_label(target_group uuid,target_label uuid,label_name text,label_color text,archived boolean,expected_token timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.lock_group(target_group); old_label public.labels; saved public.labels;
begin
  select * into old_label from public.labels where id=target_label and group_id=target_group for update;
  if found then
    if expected_token is null or expected_token<>old_label.updated_at then
      raise exception 'This label changed. Reload it before saving.' using errcode='40001';
    end if;
    saved:=old_label;
    saved.name:=coalesce(btrim(label_name),old_label.name); saved.color:=coalesce(label_color,old_label.color);
    if archived is not null then saved.archived_at:=case when not archived then null else coalesce(old_label.archived_at,clock_timestamp()) end; end if;
    if (saved.name,saved.color,saved.archived_at) is distinct from (old_label.name,old_label.color,old_label.archived_at) then
      update public.labels set name=saved.name,color=saved.color,archived_at=saved.archived_at,
        updated_at=greatest(clock_timestamp(),old_label.updated_at+interval '1 microsecond')
        where id=target_label and group_id=target_group returning * into saved;
    end if;
  else
    if expected_token is not null then raise exception 'This label is unavailable.' using errcode='P0002'; end if;
    insert into public.labels(id,group_id,name,color,archived_at,created_by_user_id)
      values(target_label,target_group,btrim(label_name),coalesce(label_color,'#20895b'),
        case when archived then clock_timestamp() else null end,actor) returning * into saved;
  end if;
  return to_jsonb(saved);
end;
$$;

create or replace function private.post_group_comment(target_group uuid,target_task uuid,comment_body text,comment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=private.lock_group(target_group); actor_display text; saved public.comments;
begin
  perform 1 from public.tasks where group_id=target_group and id=target_task for update;
  if not found then raise exception 'Task is unavailable.' using errcode='P0002'; end if;
  select * into saved from public.comments where id=comment_id;
  if found then
    if saved.group_id<>target_group or saved.task_id<>target_task or saved.author_user_id is distinct from actor or saved.body is distinct from comment_body then
      raise exception 'Comment ID is unavailable.' using errcode='42501';
    end if;
    return to_jsonb(saved);
  end if;
  select display_name into actor_display from public.profiles where id=actor;
  insert into public.comments(id,group_id,task_id,author_user_id,author_name,body)
    values(comment_id,target_group,target_task,actor,actor_display,comment_body) returning * into saved;
  return to_jsonb(saved);
end;
$$;

revoke all on function private.task_view(uuid,uuid),private.save_group_task(uuid,uuid,jsonb,uuid[],uuid[],timestamptz),
  private.delete_group_task(uuid,uuid,timestamptz),private.save_group_label(uuid,uuid,text,text,boolean,timestamptz),
  private.post_group_comment(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.save_group_task(uuid,uuid,jsonb,uuid[],uuid[],timestamptz),
  private.delete_group_task(uuid,uuid,timestamptz),private.save_group_label(uuid,uuid,text,text,boolean,timestamptz),
  private.post_group_comment(uuid,uuid,text,uuid) to authenticated;

-- Public RPCs are invoker wrappers. Only the narrowly checked private APIs
-- execute with the migration owner's privileges; no arbitrary SQL is accepted.
create or replace function public.create_group(p_name text,p_group_id uuid default gen_random_uuid())
returns jsonb language sql security invoker set search_path = '' as $$
  select private.group_operation('create',p_group_id,jsonb_build_object('name',p_name));
$$;
create or replace function public.rename_group(p_group_id uuid,p_name text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.group_operation('rename',p_group_id,jsonb_build_object('name',p_name));
$$;
create or replace function public.transfer_group_ownership(p_group_id uuid,p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.group_operation('transfer',p_group_id,jsonb_build_object('user_id',p_user_id));
$$;
create or replace function public.leave_group(p_group_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.group_operation('leave',p_group_id,'{}'); $$;
create or replace function public.remove_group_member(p_group_id uuid,p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.group_operation('remove',p_group_id,jsonb_build_object('user_id',p_user_id));
$$;
create or replace function public.delete_group(p_group_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.group_operation('delete',p_group_id,'{}'); $$;
create or replace function public.lookup_invitation_target(p_group_id uuid,p_query text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.lookup_target(p_group_id,p_query); $$;
create or replace function public.send_group_invitation(p_group_id uuid,p_recipient_user_id uuid,p_invitation_id uuid default gen_random_uuid())
returns jsonb language sql security invoker set search_path = '' as $$ select private.send_invitation(p_group_id,p_recipient_user_id,p_invitation_id); $$;
create or replace function public.respond_group_invitation(p_invitation_id uuid,p_accept boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.resolve_invitation(p_invitation_id,case when p_accept is null then null when p_accept then 'accept' else 'decline' end);
$$;
create or replace function public.revoke_group_invitation(p_invitation_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.resolve_invitation(p_invitation_id,'revoke'); $$;
create or replace function public.list_group_invitations(p_limit integer default 50,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.invitation_page(p_limit,p_before_time,p_before_id); $$;
create or replace function public.save_task(p_group_id uuid,p_task_id uuid,p_changes jsonb default '{}',
  p_assignee_ids uuid[] default null,p_label_ids uuid[] default null,p_expected_updated_at timestamptz default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_group_task(p_group_id,p_task_id,p_changes,p_assignee_ids,p_label_ids,p_expected_updated_at);
$$;
create or replace function public.delete_task(p_group_id uuid,p_task_id uuid,p_expected_updated_at timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$ select private.delete_group_task(p_group_id,p_task_id,p_expected_updated_at); $$;
create or replace function public.save_label(p_group_id uuid,p_label_id uuid,p_name text default null,p_color text default null,
  p_archived boolean default null,p_expected_updated_at timestamptz default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_group_label(p_group_id,p_label_id,p_name,p_color,p_archived,p_expected_updated_at);
$$;
create or replace function public.post_comment(p_group_id uuid,p_task_id uuid,p_body text,p_comment_id uuid default gen_random_uuid())
returns jsonb language sql security invoker set search_path = '' as $$ select private.post_group_comment(p_group_id,p_task_id,p_body,p_comment_id); $$;

do $$
declare table_name text; api_function regprocedure;
begin
  foreach table_name in array array['profiles','groups','group_members','group_invitations','tasks',
    'labels','task_assignments','task_labels','comments','task_activity'] loop
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
  end loop;
  for api_function in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_group','rename_group','transfer_group_ownership','leave_group',
      'remove_group_member','delete_group','lookup_invitation_target','send_group_invitation','respond_group_invitation',
      'revoke_group_invitation','list_group_invitations','save_task','delete_task','save_label','post_comment') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',api_function);
    execute format('grant execute on function %s to authenticated',api_function);
  end loop;
end;
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (private.can_read_profile(id));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));
grant update(username,display_name,avatar_color) on public.profiles to authenticated;

drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated using (private.has_group_access(id));
drop policy if exists invitations_read on public.group_invitations;
create policy invitations_read on public.group_invitations for select to authenticated
  using (private.can_read_invitation(group_id,inviter_user_id,recipient_user_id));
do $$
declare table_name text;
begin
  foreach table_name in array array['group_members','tasks','labels','task_assignments','task_labels','comments','task_activity'] loop
    execute format('drop policy if exists group_member_read on public.%I',table_name);
    execute format('create policy group_member_read on public.%I for select to authenticated using (private.has_group_access(group_id))',table_name);
  end loop;
end;
$$;

-- Private, content-free invalidations; application rows are never published.
do $$ begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null
    or to_regclass('realtime.messages') is null then
    raise exception 'Supabase Realtime must be installed before the application schema.';
  end if;
  -- Supabase owns this table and already enables RLS. Verify it without ALTER TABLE.
  if not (select relrowsecurity from pg_class where oid='realtime.messages'::regclass) then
    raise exception 'RLS must already be enabled on the Supabase-managed realtime.messages table.';
  end if;
end $$;

create or replace function private.can_receive_workspace_changes(target_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if target_topic = 'northstar:account:' || auth.uid()::text then
    return exists(select 1 from public.profiles where id=auth.uid());
  end if;
  if target_topic ~ '^northstar:group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return private.has_group_access(substring(target_topic from 17)::uuid);
  end if;
  return false;
end;
$$;
revoke all on function private.can_receive_workspace_changes(text) from public, anon, service_role;
grant execute on function private.can_receive_workspace_changes(text) to authenticated;
grant select on realtime.messages to authenticated;

drop policy if exists northstar_broadcast_read on realtime.messages;
create policy northstar_broadcast_read on realtime.messages for select to authenticated
using (extension='broadcast' and topic=(select realtime.topic())
  and private.can_receive_workspace_changes((select realtime.topic())));
-- Preserve other apps' policies, but never let a broad permissive policy bypass this namespace.
drop policy if exists northstar_broadcast_scope on realtime.messages;
create policy northstar_broadcast_scope on realtime.messages as restrictive for select to authenticated
using (topic not like 'northstar:%' or (extension='broadcast' and topic=(select realtime.topic())
  and private.can_receive_workspace_changes((select realtime.topic()))));
drop policy if exists northstar_broadcast_anon_scope on realtime.messages;
create policy northstar_broadcast_anon_scope on realtime.messages as restrictive for select to anon
using (topic not like 'northstar:%');
drop policy if exists northstar_broadcast_no_client_send on realtime.messages;
create policy northstar_broadcast_no_client_send on realtime.messages as restrictive for insert to public
with check (topic not like 'northstar:%');

create or replace function private.emit_workspace_change(target_topic text, area text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_topic is null then return; end if;
  -- Notifications carry neither row contents nor task/account/name snapshots.
  -- They are transactional hints; every recipient refetches under current RLS.
  begin
    perform realtime.send('{}'::jsonb,area,target_topic,true);
  exception when others then
    -- Keep CRUD available if delivery fails; periodic/focus/reconnect reconciliation repairs gaps.
    raise warning 'Workspace change notification could not be queued.';
  end;
end;
$$;
revoke all on function private.emit_workspace_change(text,text) from public, anon, authenticated, service_role;

create or replace function private.broadcast_workspace_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; target_group uuid; target_user uuid; member_group uuid;
begin
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  if tg_op='DELETE' then row_data=to_jsonb(old); else row_data=to_jsonb(new); end if;

  if tg_table_name='profiles' then
    target_user=(row_data->>'id')::uuid;
    perform private.emit_workspace_change('northstar:account:'||target_user::text,'profile');
    for member_group in select distinct group_id from public.group_members where user_id=target_user loop
      perform private.emit_workspace_change('northstar:group:'||member_group::text,'members');
    end loop;
  else
    target_group=case when tg_table_name='groups' then (row_data->>'id')::uuid else (row_data->>'group_id')::uuid end;
    if tg_table_name in ('tasks','task_assignments','task_labels','labels') then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'board');
    end if;
    if tg_table_name='labels' then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'labels');
    elsif tg_table_name in ('comments','task_activity') then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'discussion');
    elsif tg_table_name='group_members' then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'members');
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'board');
      perform private.emit_workspace_change('northstar:account:'||(row_data->>'user_id'),'directory');
    elsif tg_table_name='groups' then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'directory');
      for target_user in select user_id from public.group_members where group_id=target_group and is_active loop
        perform private.emit_workspace_change('northstar:account:'||target_user::text,'directory');
      end loop;
    elsif tg_table_name='group_invitations' then
      perform private.emit_workspace_change('northstar:group:'||target_group::text,'invitations');
      for target_user in
        select distinct id from unnest(array[(row_data->>'recipient_user_id')::uuid,
          (row_data->>'inviter_user_id')::uuid,
          (select owner_user_id from public.groups where id=target_group)]) id where id is not null
      loop
        perform private.emit_workspace_change('northstar:account:'||target_user::text,'invitations');
      end loop;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.broadcast_workspace_change() from public, anon, authenticated, service_role;

do $$ declare relation_name text; begin
  foreach relation_name in array array['profiles','groups','group_members','group_invitations','tasks',
    'task_assignments','task_labels','labels','comments','task_activity'] loop
    execute format('drop trigger if exists northstar_broadcast_change on public.%I',relation_name);
    execute format('create trigger northstar_broadcast_change after insert or update or delete on public.%I
      for each row execute function private.broadcast_workspace_change()',relation_name);
  end loop;
end $$;

-- Business revision conflicts must not trigger PostgREST transaction retries.
-- Preserve the checked private implementation, arguments, grants, and atomic rollback.
-- Public invoker wrappers translate the internal serialization signal into HTTP 409.
create or replace function public.save_task(p_group_id uuid,p_task_id uuid,p_changes jsonb default '{}',
  p_assignee_ids uuid[] default null,p_label_ids uuid[] default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.save_group_task(p_group_id,p_task_id,p_changes,p_assignee_ids,p_label_ids,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

create or replace function public.delete_task(p_group_id uuid,p_task_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.delete_group_task(p_group_id,p_task_id,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

create or replace function public.save_label(p_group_id uuid,p_label_id uuid,p_name text default null,p_color text default null,
  p_archived boolean default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.save_group_label(p_group_id,p_label_id,p_name,p_color,p_archived,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

notify pgrst, 'reload schema';
commit;
