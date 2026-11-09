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
