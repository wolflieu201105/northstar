-- READ ONLY. Run after a Phase 12 install/reset, not on the old private schema.
-- Expected at this checkpoint: 10 RLS tables, zero policies/API access,
-- real Auth profiles with active private-group ownership, no legacy members/RPC.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as unauthenticated_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as client_access,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','groups','group_members','group_invitations',
  'tasks','labels','task_assignments','task_labels','comments','task_activity') and c.relkind='r'
order by c.relname;

select (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.groups) as groups,
  (select count(*) from public.groups g where not exists (
    select 1 from public.group_members m where m.group_id=g.id
      and m.user_id=g.owner_user_id and m.is_active
  )) as invalid_group_owners,
  to_regclass('public.team_members') is null as no_placeholder_members,
  to_regclass('public.task_assignees') is null as no_legacy_assignments,
  to_regprocedure('public.save_task(uuid,jsonb,uuid[],uuid[],timestamp with time zone)') is null as no_obsolete_rpc;

select p.proname, p.prosecdef as security_definer, p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as unauthenticated_execution,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as client_execution
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname in ('guard_profile_write','initialize_account','initialize_auth_profile')
order by p.proname;

select tgname, tgenabled from pg_trigger
where tgrelid='auth.users'::regclass and tgname='northstar_initialize_auth_profile';
