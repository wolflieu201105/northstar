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
