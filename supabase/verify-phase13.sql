-- READ ONLY. Run after reset.sql, schema.sql, or the Phase 13 migration.
-- Expected: 10 RLS tables; authenticated SELECT; no direct INSERT/DELETE;
-- UPDATE only on the three editable profile columns; no unauthenticated API.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated',c.oid,'SELECT') as member_select_granted,
  has_any_column_privilege('authenticated',c.oid,'INSERT') as direct_insert,
  has_any_column_privilege('authenticated',c.oid,'UPDATE') as direct_update,
  has_table_privilege('authenticated',c.oid,'DELETE') as direct_delete,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as unauthenticated_access,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','groups','group_members','group_invitations',
  'tasks','labels','task_assignments','task_labels','comments','task_activity') and c.relkind='r'
order by c.relname;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as public_security_definer,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execution,
  has_function_privilege('anon',p.oid,'EXECUTE') as unauthenticated_execution
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('create_group','rename_group','transfer_group_ownership',
  'leave_group','remove_group_member','delete_group','lookup_invitation_target','send_group_invitation',
  'respond_group_invitation','revoke_group_invitation','list_group_invitations','save_task','delete_task','save_label','post_comment')
order by p.proname;

select p.proname,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as client_execution,
  has_function_privilege('anon',p.oid,'EXECUTE') as unauthenticated_execution
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname in ('append_task_event','current_actor','consume_api_budget',
  'initialize_account','initialize_auth_profile','lock_group','capture_group_task_activity','capture_group_relation_activity')
order by p.proname;

select count(*) as invalid_group_owners from public.groups g where not exists(
  select 1 from public.group_members m where m.group_id=g.id and m.user_id=g.owner_user_id and m.is_active
);
select (select count(*) from auth.users) as auth_accounts,(select count(*) from public.profiles) as actual_profiles;
select column_name from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE'
order by column_name;
