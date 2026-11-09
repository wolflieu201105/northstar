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
