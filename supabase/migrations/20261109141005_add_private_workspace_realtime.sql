-- GENERATED Phase 17: private workspace live updates.
begin;

-- Phase 17: private, content-free invalidations; application rows are never published.
do $$ begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null
    or to_regclass('realtime.messages') is null then
    raise exception 'Supabase Realtime must be installed before Phase 17.';
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

notify pgrst, 'reload schema';
commit;
