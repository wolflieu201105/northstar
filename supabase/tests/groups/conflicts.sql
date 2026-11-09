-- LOCAL ONLY. Public revision errors must reach PostgREST as PT409, never 40001.
begin;
\ir helpers.sql
select test.assert_true((select count(*)=3 and bool_and(not p.prosecdef
  and p.proconfig=array['search_path=""'] and p.prosrc like '%PT409%')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('save_task','delete_task','save_label')),
  'all revision wrappers remain invokers with fixed search paths');
select test.assert_true(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('save_task','delete_task','save_label')
  and (has_function_privilege('anon',p.oid,'EXECUTE') or not has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  'wrapper replacement preserves authenticated-only grants');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_group('Conflict fixture','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18');
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18','{"title":"Original"}');
select public.save_label('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','cccccccc-cccc-4ccc-8ccc-cccccccccc18','Original label');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18',
  '{"title":"Rejected"}',null,null,'2020-01-01')$q$,'PT409','stale task save maps to HTTP conflict');
select test.expect_error($q$select public.delete_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18',
  '2020-01-01')$q$,'PT409','stale task deletion maps to HTTP conflict');
select test.expect_error($q$select public.save_label('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','cccccccc-cccc-4ccc-8ccc-cccccccccc18',
  'Rejected label',null,null,'2020-01-01')$q$,'PT409','stale label save maps to HTTP conflict');
select test.assert_true((select title='Original' from public.tasks where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18')
  and (select name='Original label' from public.labels where id='cccccccc-cccc-4ccc-8ccc-cccccccccc18')
  and (select count(*)=1 from public.task_activity where task_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18'),
  'mapped conflicts preserve rows and append no success events');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18',
  '{"title":"Unauthorized"}',null,null,'2020-01-01')$q$,'42501','wrapper does not turn access denial into a conflict');
reset role;
select count(*) || ' revision conflict checks passed' from test.results;
rollback;
