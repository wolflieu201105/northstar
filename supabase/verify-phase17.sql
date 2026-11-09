-- READ ONLY. Run after the Phase 17 migration; this changes no schema or data.
select c.relrowsecurity as messages_rls_enabled,
  has_table_privilege('authenticated','realtime.messages','SELECT') as authenticated_can_read_with_rls,
  to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null as native_broadcast_available
from pg_class c where c.oid='realtime.messages'::regclass;

select policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='realtime' and tablename='messages' and policyname like 'northstar_%'
order by policyname;

select c.relname as application_table,t.tgname as notification_trigger
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and t.tgname='northstar_broadcast_change' and not t.tgisinternal order by c.relname;

select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as unauthenticated_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname in ('can_receive_workspace_changes','emit_workspace_change','broadcast_workspace_change')
order by p.proname;

-- This should contain no Northstar application tables. Private Broadcast needs no application publication.
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by schemaname,tablename;
