-- READ-ONLY hosted-project inspection before the enhancement upgrade.
-- Historical private schema only. Current group setup uses verify-phase13.sql.
-- Run in SQL Editor for the intended project; this does not alter its schema/data.

select current_database() as database_name,
  current_setting('server_version') as postgres_version;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as forced_rls
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid = 'public.tasks'::regclass
order by conname;

select policyname, roles, cmd, qual as using_expression, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'tasks'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'tasks'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type, column_name;

select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public' and tablename = 'tasks'
order by indexname;

select tgname, pg_get_triggerdef(oid) as definition
from pg_catalog.pg_trigger
where tgrelid = 'public.tasks'::regclass and not tgisinternal
order by tgname;

select n.nspname as function_schema, p.proname,
  p.prosecdef as security_definer, p.proconfig, p.proacl,
  pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.prokind = 'f' and (
  (n.nspname = 'public' and p.proname = 'set_tasks_updated_at')
  or n.nspname = 'private'
)
order by n.nspname, p.proname;

-- Counts contain no task text, owner IDs, or access tokens.
select count(*) as existing_task_count,
  count(distinct user_id) as existing_task_owner_count
from public.tasks;
