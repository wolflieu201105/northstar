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
