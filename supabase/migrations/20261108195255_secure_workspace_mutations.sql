begin;

-- Phase 3: ownership policies, atomic task saves, and trusted activity capture.
-- Apply after the Phase 2 workspace data model. Keep this block in schema.sql too.

-- An event-trigger helper supplied by this project's Supabase setup was publicly
-- executable. Event triggers need no API execution grant. Keep its behavior intact.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
      and p.pronargs = 0 and p.prorettype = 'pg_catalog.event_trigger'::regtype
  ) then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;

-- Retain the current app's task operations, with stable creation IDs permitted.
grant insert (id) on public.tasks to authenticated;

revoke all on table public.team_members, public.labels, public.task_assignees,
  public.task_labels, public.comments, public.task_activity
from public, anon, authenticated;

grant select on public.team_members, public.labels, public.task_assignees,
  public.task_labels, public.comments, public.task_activity to authenticated;
grant insert (id, user_id, name, avatar_color) on public.team_members to authenticated;
grant update (name, avatar_color, archived_at) on public.team_members to authenticated;
grant insert (id, user_id, name, color) on public.labels to authenticated;
grant update (name, color, archived_at) on public.labels to authenticated;
grant insert (user_id, task_id, member_id) on public.task_assignees to authenticated;
grant insert (user_id, task_id, label_id) on public.task_labels to authenticated;
grant delete on public.task_assignees, public.task_labels to authenticated;
grant insert (id, user_id, task_id, body) on public.comments to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'team_members', 'labels', 'task_assignees', 'task_labels', 'comments', 'task_activity'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists read_own_rows on public.%I', table_name);
    execute format(
      'create policy read_own_rows on public.%I for select to authenticated
       using ((select auth.uid()) = user_id)', table_name
    );
    if table_name <> 'task_activity' then
      execute format('drop policy if exists insert_own_rows on public.%I', table_name);
      execute format(
        'create policy insert_own_rows on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', table_name
      );
    end if;
  end loop;

  foreach table_name in array array['team_members', 'labels'] loop
    execute format('drop policy if exists update_own_rows on public.%I', table_name);
    execute format(
      'create policy update_own_rows on public.%I for update to authenticated
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)', table_name
    );
  end loop;

  foreach table_name in array array['task_assignees', 'task_labels'] loop
    execute format('drop policy if exists delete_own_rows on public.%I', table_name);
    execute format(
      'create policy delete_own_rows on public.%I for delete to authenticated
       using ((select auth.uid()) = user_id)', table_name
    );
  end loop;
end;
$$;

-- Event time is the actual write time, not the transaction's start time.
-- Waiting on a task row must not backdate the resulting timeline entry.
alter table public.task_activity alter column created_at set default clock_timestamp();

-- Composite owner/task foreign keys supply parent ownership on child rows.
-- Child keys are immutable and their owner must match the authenticated identity.

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Task identity, ownership, and creation time cannot be changed.'
      using errcode = '42501';
  end if;
  -- A monotonic token also distinguishes several writes inside one transaction.
  new.updated_at = greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.set_tasks_updated_at() from public, anon, authenticated;

-- Every insert takes task -> profile/label locks in the same order as save_task.
-- Row locks protect active-state validation against concurrent archival.
create or replace function private.validate_active_task_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  referenced_archived_at timestamptz;
begin
  if tg_table_schema <> 'public' or tg_table_name not in ('task_assignees', 'task_labels')
    or tg_op <> 'INSERT'
  then
    raise exception 'Unsupported relationship trigger.' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'A matching guest session is required.' using errcode = '42501';
  end if;

  perform 1 from public.tasks t
  where t.id = new.task_id and t.user_id = new.user_id for update;
  if not found then
    raise exception 'Task is unavailable in this workspace.' using errcode = '23503';
  end if;

  if tg_table_name = 'task_assignees' then
    select m.archived_at into referenced_archived_at from public.team_members m
    where m.user_id = new.user_id and m.id = new.member_id for share;
  else
    select l.archived_at into referenced_archived_at from public.labels l
    where l.user_id = new.user_id and l.id = new.label_id for share;
  end if;
  if not found then
    raise exception 'Related record is unavailable in this workspace.' using errcode = '23503';
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

create or replace function private.lock_task_for_relationship_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_schema <> 'public' or tg_table_name not in ('task_assignees', 'task_labels')
    or tg_op <> 'DELETE'
  then
    raise exception 'Unsupported relationship trigger.' using errcode = '42501';
  end if;
  perform 1 from public.tasks t
  where t.user_id = old.user_id and t.id = old.task_id for update;
  -- A missing parent is normal during task/auth-user cascade cleanup.
  return old;
end;
$$;
revoke all on function private.lock_task_for_relationship_delete()
  from public, anon, authenticated, service_role;

drop trigger if exists lock_task_before_assignee_delete on public.task_assignees;
create trigger lock_task_before_assignee_delete
before delete on public.task_assignees for each row
execute function private.lock_task_for_relationship_delete();
drop trigger if exists lock_task_before_label_delete on public.task_labels;
create trigger lock_task_before_label_delete
before delete on public.task_labels for each row
execute function private.lock_task_for_relationship_delete();

-- This is the only privileged application function. It is trigger-only, lives
-- outside the exposed schema, accepts no client arguments, and derives all events
-- from its source row. It never grants an arbitrary append-history capability.
create or replace function private.capture_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  parent_task_id uuid;
  actor_id uuid := auth.uid();
  related_id uuid;
  related_name text;
  related_color text;
  event_name text;
  event_payload jsonb;
  field_changes jsonb := '{}'::jsonb;
  field_name text;
begin
  if tg_table_schema <> 'public' or tg_when <> 'AFTER' or tg_level <> 'ROW' then
    raise exception 'Unsupported activity trigger.' using errcode = '42501';
  end if;

  if tg_table_name = 'tasks' and tg_op in ('INSERT', 'UPDATE') then
    owner_id := new.user_id;
    parent_task_id := new.id;
    if actor_id is null or actor_id is distinct from owner_id then
      raise exception 'A matching guest session is required to record task changes.'
        using errcode = '42501';
    end if;

    if tg_op = 'INSERT' then
      insert into public.task_activity(user_id, task_id, actor_user_id, event_type, payload)
      values (owner_id, parent_task_id, actor_id, 'task_created',
        jsonb_build_object('version', 1, 'title', new.title, 'status', new.status));
      return new;
    end if;

    if old.status is distinct from new.status then
      insert into public.task_activity(user_id, task_id, actor_user_id, event_type, payload)
      values (owner_id, parent_task_id, actor_id, 'status_changed',
        jsonb_build_object('version', 1, 'from', old.status, 'to', new.status));
    end if;
    foreach field_name in array array['title', 'description', 'priority', 'due_date'] loop
      if (to_jsonb(old) -> field_name) is distinct from (to_jsonb(new) -> field_name) then
        field_changes := field_changes || jsonb_build_object(field_name,
          jsonb_build_object('from', to_jsonb(old) -> field_name, 'to', to_jsonb(new) -> field_name));
      end if;
    end loop;
    if field_changes <> '{}'::jsonb then
      insert into public.task_activity(user_id, task_id, actor_user_id, event_type, payload)
      values (owner_id, parent_task_id, actor_id, 'task_edited',
        jsonb_build_object('version', 1, 'changes', field_changes));
    end if;
    return new;

  elsif tg_table_name in ('task_assignees', 'task_labels') and tg_op in ('INSERT', 'DELETE') then
    if tg_op = 'INSERT' then
      owner_id := new.user_id;
      parent_task_id := new.task_id;
    else
      owner_id := old.user_id;
      parent_task_id := old.task_id;
    end if;

    -- No terminal events are retained for deleted tasks or deleted auth owners.
    -- Check both before the actor requirement so privileged auth cleanup works.
    if not exists (select 1 from auth.users u where u.id = owner_id) then
      if tg_op = 'DELETE' then return old; end if;
      raise exception 'Task owner is unavailable.' using errcode = '23503';
    end if;
    perform 1 from public.tasks t
    where t.id = parent_task_id and t.user_id = owner_id for update;
    if not found then
      if tg_op = 'DELETE' then return old; end if;
      raise exception 'Task is unavailable.' using errcode = '23503';
    end if;
    if actor_id is null or actor_id is distinct from owner_id then
      raise exception 'A matching guest session is required to record task changes.'
        using errcode = '42501';
    end if;

    if tg_table_name = 'task_assignees' then
      if tg_op = 'INSERT' then related_id := new.member_id;
      else related_id := old.member_id; end if;
      select m.name, m.avatar_color into related_name, related_color
      from public.team_members m where m.user_id = owner_id and m.id = related_id;
      event_name := case when tg_op = 'INSERT' then 'assignee_added' else 'assignee_removed' end;
      event_payload := jsonb_build_object('version', 1, 'member_id', related_id,
        'member_name', coalesce(related_name, 'Deleted member'), 'avatar_color', related_color);
    else
      if tg_op = 'INSERT' then related_id := new.label_id;
      else related_id := old.label_id; end if;
      select l.name, l.color into related_name, related_color
      from public.labels l where l.user_id = owner_id and l.id = related_id;
      event_name := case when tg_op = 'INSERT' then 'label_added' else 'label_removed' end;
      event_payload := jsonb_build_object('version', 1, 'label_id', related_id,
        'label_name', coalesce(related_name, 'Deleted label'), 'color', related_color);
    end if;

    insert into public.task_activity(user_id, task_id, actor_user_id, event_type, payload)
    values (owner_id, parent_task_id, actor_id, event_name, event_payload);

    -- The timestamp trigger supplies a fresh conflict token. The task event
    -- trigger sees identical scalar fields and therefore emits no edit event.
    update public.tasks set title = title
    where id = parent_task_id and user_id = owner_id;

    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  raise exception 'Unsupported activity source.' using errcode = '42501';
end;
$$;
revoke all on function private.capture_task_activity()
  from public, anon, authenticated, service_role;

drop trigger if exists capture_task_changes on public.tasks;
create trigger capture_task_changes after insert or update on public.tasks
for each row execute function private.capture_task_activity();
drop trigger if exists capture_assignee_changes on public.task_assignees;
create trigger capture_assignee_changes after insert or delete on public.task_assignees
for each row execute function private.capture_task_activity();
drop trigger if exists capture_label_changes on public.task_labels;
create trigger capture_label_changes after insert or delete on public.task_labels
for each row execute function private.capture_task_activity();

create or replace function public.save_task(
  p_task_id uuid default null,
  p_changes jsonb default '{}'::jsonb,
  p_assignee_ids uuid[] default null,
  p_label_ids uuid[] default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  task_row public.tasks%rowtype;
  record_exists boolean := false;
  saved_task_id uuid := coalesce(p_task_id, gen_random_uuid());
  next_title text;
  next_description text;
  next_status text;
  next_priority text;
  next_due_date date;
  selected_members uuid[];
  selected_labels uuid[];
  property text;
begin
  if owner_id is null then
    raise exception 'A guest session is required.' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Task changes must be a JSON object.' using errcode = '22023';
  end if;
  for property in select jsonb_object_keys(p_changes) loop
    if property not in ('title', 'description', 'status', 'priority', 'due_date') then
      raise exception 'Unsupported task field: %', property using errcode = '22023';
    end if;
    if jsonb_typeof(p_changes -> property) <> 'string'
      and not (property in ('description', 'due_date') and p_changes -> property = 'null'::jsonb)
    then
      raise exception 'Invalid value for task field: %', property using errcode = '22023';
    end if;
  end loop;

  if p_assignee_ids is not null and array_position(p_assignee_ids, null) is not null
    or p_label_ids is not null and array_position(p_label_ids, null) is not null
  then
    raise exception 'Relationship IDs cannot contain null.' using errcode = '22023';
  end if;
  if p_assignee_ids is not null then
    select coalesce(array_agg(distinct x order by x), '{}'::uuid[]) into selected_members
    from unnest(p_assignee_ids) x;
  end if;
  if p_label_ids is not null then
    select coalesce(array_agg(distinct x order by x), '{}'::uuid[]) into selected_labels
    from unnest(p_label_ids) x;
  end if;

  select t.* into task_row from public.tasks t
  where t.id = saved_task_id and t.user_id = owner_id for update;
  record_exists := found;
  if record_exists then
    if p_expected_updated_at is null or task_row.updated_at <> p_expected_updated_at then
      raise exception 'This task changed. Reload it and review your draft before saving.'
        using errcode = '40001';
    end if;
  elsif p_expected_updated_at is not null then
    raise exception 'Task is unavailable in this workspace.' using errcode = 'P0002';
  end if;

  next_title := case when p_changes ? 'title' then btrim(p_changes ->> 'title')
    else task_row.title end;
  if next_title is null or next_title !~ '[^[:space:]]' then
    raise exception 'A nonblank task title is required.' using errcode = '22023';
  end if;
  next_description := case when p_changes ? 'description'
    then nullif(btrim(p_changes ->> 'description'), '') else task_row.description end;
  next_status := case when p_changes ? 'status' then p_changes ->> 'status'
    else coalesce(task_row.status, 'todo') end;
  next_priority := case when p_changes ? 'priority' then p_changes ->> 'priority'
    else coalesce(task_row.priority, 'normal') end;
  if p_changes ? 'due_date' and p_changes ->> 'due_date' is not null
    and (p_changes ->> 'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  then
    raise exception 'Due date must use YYYY-MM-DD or null.' using errcode = '22023';
  end if;
  next_due_date := case when p_changes ? 'due_date'
    then (p_changes ->> 'due_date')::date else task_row.due_date end;

  -- Deterministic row locks prevent archival racing this transaction.
  -- Archived records are allowed only when the task already has that link.
  if selected_members is not null then
    perform m.id from public.team_members m
    where m.user_id = owner_id and m.id = any(selected_members) order by m.id for share;
    if (select count(*) from public.team_members m
        where m.user_id = owner_id and m.id = any(selected_members)) <> cardinality(selected_members)
    then
      raise exception 'An assignee is unavailable in this workspace.' using errcode = '23503';
    end if;
    if exists (
      select 1 from public.team_members m
      where m.user_id = owner_id and m.id = any(selected_members) and m.archived_at is not null
        and not exists (select 1 from public.task_assignees a
          where a.user_id = owner_id and a.task_id = saved_task_id and a.member_id = m.id)
    ) then
      raise exception 'Archived members cannot be added.' using errcode = '23514';
    end if;
  end if;
  if selected_labels is not null then
    perform l.id from public.labels l
    where l.user_id = owner_id and l.id = any(selected_labels) order by l.id for share;
    if (select count(*) from public.labels l
        where l.user_id = owner_id and l.id = any(selected_labels)) <> cardinality(selected_labels)
    then
      raise exception 'A label is unavailable in this workspace.' using errcode = '23503';
    end if;
    if exists (
      select 1 from public.labels l
      where l.user_id = owner_id and l.id = any(selected_labels) and l.archived_at is not null
        and not exists (select 1 from public.task_labels a
          where a.user_id = owner_id and a.task_id = saved_task_id and a.label_id = l.id)
    ) then
      raise exception 'Archived labels cannot be added.' using errcode = '23514';
    end if;
  end if;

  if not record_exists then
    insert into public.tasks(id, user_id, title, description, status, priority, due_date)
    values (saved_task_id, owner_id, next_title, next_description, next_status, next_priority, next_due_date);
  elsif task_row.title is distinct from next_title
    or task_row.description is distinct from next_description
    or task_row.status is distinct from next_status
    or task_row.priority is distinct from next_priority
    or task_row.due_date is distinct from next_due_date
  then
    update public.tasks t set title = next_title, description = next_description,
      status = next_status, priority = next_priority, due_date = next_due_date
    where t.id = saved_task_id and t.user_id = owner_id;
  end if;

  if selected_members is not null then
    delete from public.task_assignees a
    where a.user_id = owner_id and a.task_id = saved_task_id and not (a.member_id = any(selected_members));
    insert into public.task_assignees(user_id, task_id, member_id)
    select owner_id, saved_task_id, x from unnest(selected_members) x
    where not exists (select 1 from public.task_assignees a
      where a.user_id = owner_id and a.task_id = saved_task_id and a.member_id = x);
  end if;
  if selected_labels is not null then
    delete from public.task_labels a
    where a.user_id = owner_id and a.task_id = saved_task_id and not (a.label_id = any(selected_labels));
    insert into public.task_labels(user_id, task_id, label_id)
    select owner_id, saved_task_id, x from unnest(selected_labels) x
    where not exists (select 1 from public.task_labels a
      where a.user_id = owner_id and a.task_id = saved_task_id and a.label_id = x);
  end if;

  select t.* into task_row from public.tasks t where t.id = saved_task_id and t.user_id = owner_id;
  return to_jsonb(task_row) || jsonb_build_object(
    'assignees', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.name, m.id), '[]'::jsonb)
      from public.team_members m join public.task_assignees a
        on a.user_id = m.user_id and a.member_id = m.id
      where a.user_id = owner_id and a.task_id = saved_task_id
    ),
    'labels', (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.name, l.id), '[]'::jsonb)
      from public.labels l join public.task_labels a
        on a.user_id = l.user_id and a.label_id = l.id
      where a.user_id = owner_id and a.task_id = saved_task_id
    )
  );
end;
$$;

revoke all on function public.save_task(uuid, jsonb, uuid[], uuid[], timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.save_task(uuid, jsonb, uuid[], uuid[], timestamptz)
  to authenticated;

comment on function public.save_task(uuid, jsonb, uuid[], uuid[], timestamptz) is
  'Atomic owner-only task save. Existing rows require their exact updated_at token. NULL relationship arrays preserve links; empty arrays clear them. Supply a stable UUID for safe create reconciliation.';
comment on table public.task_activity is
  'Owner-readable, trigger-generated history. API roles have no write privileges.';

-- Publish the new RPC/table metadata only when this transaction commits.
notify pgrst, 'reload schema';

commit;
