-- READ ONLY. All three routines should return true in every boolean column.
select p.proname,
  not p.prosecdef as remains_security_invoker,
  p.proconfig = array['search_path=""'] as fixed_empty_search_path,
  p.prosrc like '%PT409%' and p.prosrc like '%serialization_failure%' as translates_revision_conflicts,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  not has_function_privilege('anon',p.oid,'EXECUTE') as unauthenticated_denied
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('save_task','delete_task','save_label')
order by p.proname;
