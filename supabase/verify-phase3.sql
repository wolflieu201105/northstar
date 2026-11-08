-- READ-ONLY metadata checks after applying the Phase 3 migration.
-- This verifies installed objects/ACLs, not real guest JWT/Data API isolation.

select c.relname as table_name, c.relrowsecurity as rls_enabled,
  (select count(*) from pg_catalog.pg_policy p where p.polrelid = c.oid) as policy_count,
  has_table_privilege('authenticated', c.oid, 'SELECT') as guest_can_select,
  has_table_privilege('anon', c.oid, 'SELECT') as unauthenticated_can_select
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'team_members', 'labels', 'task_assignees', 'task_labels', 'comments', 'task_activity'
)
order by c.relname;

select p.oid::regprocedure::text as function_name,
  p.prosecdef as security_definer, p.proconfig as settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as guest_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as unauthenticated_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.prokind = 'f' and (
  (n.nspname = 'public' and p.proname in ('save_task', 'rls_auto_enable'))
  or (n.nspname = 'private' and p.proname = 'capture_task_activity')
)
order by n.nspname, p.proname;

select has_table_privilege('authenticated','public.task_activity','INSERT')
    or has_any_column_privilege('authenticated','public.task_activity','INSERT') as guest_can_forge_history,
  has_table_privilege('authenticated','public.task_activity','UPDATE')
    or has_any_column_privilege('authenticated','public.task_activity','UPDATE') as guest_can_rewrite_history,
  has_table_privilege('authenticated','public.task_activity','DELETE') as guest_can_delete_history;

select c.relname as table_name, t.tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
  and t.tgname in ('capture_task_changes','capture_assignee_changes','capture_label_changes')
order by c.relname, t.tgname;
