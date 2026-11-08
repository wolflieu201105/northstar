-- LOCAL ROLE/CLAIM SIMULATION ONLY. No real guest tokens or hosted writes.
begin;
create table test.results(name text primary key);
create table test.responses(name text primary key, body jsonb);
grant usage on schema test to anon, authenticated;
grant select, insert on test.results, test.responses to anon, authenticated;

create function test.assert_true(condition boolean, test_name text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %', test_name; end if;
  insert into test.results values(test_name);
end;
$$;
create function test.expect_error(statement text, expected_state text, test_name text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_state then
      raise exception 'FAIL: % (expected %, received %: %)', test_name, expected_state, sqlstate, sqlerrm;
    end if;
    insert into test.results values(test_name);
    return;
  end;
  raise exception 'FAIL: % (expected error %)', test_name, expected_state;
end;
$$;

select test.assert_true(
  not (select prosecdef from pg_proc where oid =
    'public.save_task(uuid,jsonb,uuid[],uuid[],timestamp with time zone)'::regprocedure),
  'task save RPC is security invoker'
);
select test.assert_true(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.capture_task_activity()'::regprocedure),
  'activity writer has an explicit empty search path'
);
select test.assert_true(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join unnest(array['anon','authenticated']) api_role
    where n.nspname in ('public','private') and p.prosecdef
      and has_function_privilege(api_role,p.oid,'EXECUTE')
  ),
  'no privileged application function is executable by API roles'
);

set local role anon;
select test.expect_error('select * from public.team_members','42501','unauthenticated clients cannot read members');
select test.expect_error('select public.save_task(p_changes => ''{"title":"Anon"}'')','42501','unauthenticated clients cannot call the save RPC');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select test.assert_true((select count(*)=0 from public.tasks),'authenticated role without an identity cannot read tasks');
select test.expect_error('select public.save_task(p_changes => ''{"title":"No identity"}'')','42501','authenticated role without an identity cannot save tasks');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.team_members(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Alex'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','Sam');
insert into public.labels(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','Bug'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','Design');
select test.assert_true((select count(*)=1 from public.tasks),'A sees only their own baseline task');
select test.expect_error($q$
 insert into public.team_members(user_id,name)
 values('22222222-2222-4222-8222-222222222222','Forged')
$q$,'42501','A cannot insert a record owned by B');
select test.expect_error($q$
 update public.team_members set user_id='22222222-2222-4222-8222-222222222222'
$q$,'42501','clients cannot change record ownership');
select test.expect_error('update public.labels set created_at=now()','42501','clients cannot rewrite timestamps');
select test.expect_error('delete from public.team_members','42501','members use archive instead of guest deletion');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.team_members(id,name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Jordan');
insert into public.labels(id,name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','Bug');
select test.assert_true((select count(*)=1 from public.team_members),'B cannot read A members');
select test.assert_true((select count(*)=1 from public.labels),'B cannot read A labels');
update public.team_members set name='Attempted overwrite'
 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
select test.assert_true(
 not exists(select 1 from public.team_members where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
 'unauthorized member update returns no visible row'
);
select test.expect_error($q$
 insert into public.task_assignees(task_id,member_id)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
$q$,'23503','B cannot attach a B member to A task');
select test.expect_error($q$
 insert into public.comments(task_id,body)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Forbidden')
$q$,'23503','B cannot comment on A task');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.assert_true(
 (select name='Alex' from public.team_members where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
 'A member remains unchanged after B update attempt'
);
select test.expect_error($q$
 insert into public.task_assignees(task_id,member_id)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
$q$,'23503','A cannot assign B member');
select test.expect_error($q$
 insert into public.task_labels(task_id,label_id)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4')
$q$,'23503','A cannot attach B label');

insert into test.responses values('created',public.save_task(
 p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
 p_changes=>'{"title":"  Test task  ","description":"Details","priority":"high"}',
 p_assignee_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],
 p_label_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::uuid[]
));
select test.assert_true(
 (select body->>'title'='Test task' and body->>'status'='todo'
   and jsonb_array_length(body->'assignees')=1 and jsonb_array_length(body->'labels')=1
  from test.responses where name='created'),
 'RPC normalizes text, defaults scalar fields, and deduplicates relations'
);
select test.assert_true(
 (select count(*)=3 from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'creation and each new relationship are recorded once'
);
select test.assert_true(
 (select bool_and(created_at > transaction_timestamp()) from public.task_activity
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'history timestamps use write time instead of transaction start'
);
select test.assert_true(
 (select bool_and(actor_user_id=user_id and user_id=auth.uid())
  from public.task_activity),
 'database activity actor always matches the authenticated owner'
);

insert into test.responses values('noop',public.save_task(
 p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
 p_changes=>'{}',
 p_assignee_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],
 p_label_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::uuid[],
 p_expected_updated_at=>(select (body->>'updated_at')::timestamptz from test.responses where name='created')
));
select test.assert_true(
 (select body->>'updated_at' from test.responses where name='noop')=
 (select body->>'updated_at' from test.responses where name='created')
 and (select count(*)=3 from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'no-op RPC does not advance timestamp or duplicate activity'
);
select test.expect_error($q$
 select public.save_task(p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"title":"Missing token"}')
$q$,'40001','editing requires an expected-change token');
select test.expect_error($q$
 select public.save_task(p_changes=>'{"user_id":"11111111-1111-4111-8111-111111111111"}')
$q$,'22023','RPC rejects arbitrary protected fields');
select test.expect_error($q$
 select public.save_task(p_changes=>'{"title":"Bad","due_date":"tomorrow"}')
$q$,'22023','RPC accepts only canonical date strings');
select test.expect_error($q$
 select public.save_task(p_changes=>'{"title":null}')
$q$,'22023','RPC rejects invalid scalar JSON types');

insert into test.responses values('edited',public.save_task(
 p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
 p_changes=>'{"title":"Revised","status":"in_progress","due_date":"2026-12-20"}',
 p_expected_updated_at=>(select (body->>'updated_at')::timestamptz from test.responses where name='created')
));
select test.assert_true(
 (select body->>'status'='in_progress' and jsonb_array_length(body->'assignees')=1
   and jsonb_array_length(body->'labels')=1 from test.responses where name='edited'),
 'omitted relation arrays preserve links during field edits'
);
select test.assert_true(
 exists(select 1 from public.task_activity
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and event_type='status_changed'
   and payload->>'from'='todo' and payload->>'to'='in_progress'),
 'status activity contains trusted old and new status'
);
select test.assert_true(
 exists(select 1 from public.task_activity
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and event_type='task_edited'
   and payload#>>'{changes,title,from}'='Test task' and payload#>>'{changes,title,to}'='Revised'
   and payload#>>'{changes,due_date,to}'='2026-12-20'),
 'edit activity records actual old and new values'
);
select test.expect_error($q$
 select public.save_task(
  p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"title":"Stale"}',
  p_expected_updated_at=>(select (body->>'updated_at')::timestamptz from test.responses where name='created')
 )
$q$,'40001','stale task edits are rejected');
select test.assert_true(
 (select title='Revised' from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'stale edits leave persisted fields unchanged'
);

insert into test.responses values('before_invalid',jsonb_build_object(
 'task',(select to_jsonb(t) from public.tasks t where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'events',(select count(*) from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
));
select test.expect_error($q$
 select public.save_task(
  p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"title":"Forbidden relation"}',
  p_assignee_ids=>array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2']::uuid[],
  p_expected_updated_at=>(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 )
$q$,'23503','atomic save rejects a foreign-owner relation');
select test.assert_true(
 (select body->'task' from test.responses where name='before_invalid')=
 (select to_jsonb(t) from public.tasks t where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 and (select (body->>'events')::bigint from test.responses where name='before_invalid')=
 (select count(*) from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'failed relation validation preserves task and history'
);

update public.team_members set name='Alex Renamed',archived_at=now()
 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
update public.labels set name='Bug Renamed',archived_at=now()
 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
select test.assert_true(
 exists(select 1 from public.task_activity
  where event_type='assignee_added' and payload->>'member_name'='Alex')
 and exists(select 1 from public.task_activity
  where event_type='label_added' and payload->>'label_name'='Bug'),
 'rename and archive do not rewrite historic names'
);
insert into test.responses values('retained_archived',public.save_task(
 p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"description":"New details"}',
 p_assignee_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],
 p_label_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::uuid[],
 p_expected_updated_at=>(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
));
select test.assert_true(
 (select jsonb_array_length(body->'assignees')=1 and jsonb_array_length(body->'labels')=1
  from test.responses where name='retained_archived'),
 'existing archived relationships can be retained'
);

-- Force a failure after scalar updates and relation removal to prove rollback,
-- rather than testing only validation failures before the first write.
reset role;
create function test.fail_activity() returns trigger language plpgsql as $$
begin
 if new.event_type='assignee_added' and current_setting('test.fail_activity',true)='on' then
  raise exception 'Synthetic history write failure';
 end if;
 return new;
end;
$$;
create trigger test_fail_activity before insert on public.task_activity
 for each row execute function test.fail_activity();
set local role authenticated;
select set_config('test.fail_activity','on',true);
insert into test.responses values('before_failure',jsonb_build_object(
 'task',(select to_jsonb(t) from public.tasks t where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'events',(select count(*) from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
));
select test.expect_error($q$
 select public.save_task(
  p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"title":"Must roll back","status":"done"}',
  p_assignee_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3']::uuid[], p_label_ids=>'{}'::uuid[],
  p_expected_updated_at=>(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 )
$q$,'P0001','history failure aborts a partially applied task save');
select test.assert_true(
 (select body->'task' from test.responses where name='before_failure')=
 (select to_jsonb(t) from public.tasks t where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 and (select (body->>'events')::bigint from test.responses where name='before_failure')=
 (select count(*) from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 and exists(select 1 from public.task_assignees
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and member_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
 and exists(select 1 from public.task_labels
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and label_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
 'failed save rolls back fields, tokens, relation removals, and all events'
);
select set_config('test.fail_activity','off',true);

insert into test.responses values('before_clear',jsonb_build_object(
 'token',(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'edits',(select count(*) from public.task_activity
  where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and event_type='task_edited')
));
insert into test.responses values('cleared',public.save_task(
 p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
 p_assignee_ids=>'{}'::uuid[],p_label_ids=>'{}'::uuid[],
 p_expected_updated_at=>(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
));
select test.assert_true(
 (select jsonb_array_length(body->'assignees')=0 and jsonb_array_length(body->'labels')=0
   from test.responses where name='cleared'),
 'empty arrays clear all assignments and labels'
);
select test.assert_true(
 (select body->>'updated_at' from test.responses where name='cleared')<>
 (select body->>'token' from test.responses where name='before_clear')
 and (select (body->>'edits')::bigint from test.responses where name='before_clear')=
 (select count(*) from public.task_activity
   where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and event_type='task_edited'),
 'relationship-only save advances token without a fictitious field-edit event'
);
select test.assert_true(
 exists(select 1 from public.task_activity
  where event_type='assignee_removed' and payload->>'member_name'='Alex Renamed')
 and exists(select 1 from public.task_activity
  where event_type='label_removed' and payload->>'label_name'='Bug Renamed'),
 'relationship removals snapshot the name at removal'
);
select test.expect_error($q$
 insert into public.task_assignees(task_id,member_id)
 values('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
$q$,'23514','direct assignment cannot re-add an archived member');
select test.expect_error($q$
 select public.save_task(
  p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  p_label_ids=>array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::uuid[],
  p_expected_updated_at=>(select updated_at from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
 )
$q$,'23514','RPC cannot add an archived label');

-- Direct writes made by the existing frontend are also captured.
update public.tasks set status='in_review'
 where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select test.assert_true(
 exists(select 1 from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  and event_type='status_changed' and payload->>'to'='in_review'),
 'direct status updates are recorded'
);
insert into public.task_assignees(task_id,member_id)
 values('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
select test.assert_true(
 exists(select 1 from public.task_activity where task_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  and event_type='assignee_added' and payload->>'member_name'='Sam'),
 'direct assignment inserts are recorded'
);
insert into public.comments(id,task_id,body)
 values('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','cccccccc-cccc-4ccc-8ccc-ccccccccccc1','A comment');
select test.assert_true(
 (select count(*)=1 from public.comments),
 'guest can create and read a comment on their task'
);
select test.expect_error('update public.comments set body=''Changed''','42501','comment updates are denied');
select test.expect_error('delete from public.comments','42501','comment deletion is denied');
select test.expect_error('update public.task_activity set payload=''{}''','42501','history updates are denied');
select test.expect_error('delete from public.task_activity','42501','history deletion is denied');
select test.expect_error($q$
 insert into public.task_activity(task_id,event_type)
 values('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','task_created')
$q$,'42501','history forgery is denied');
select test.expect_error('select private.capture_task_activity()','42501','private history helper cannot be invoked directly');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.assert_true((select count(*)=0 from public.task_activity),'B cannot read A history');
select test.assert_true((select count(*)=0 from public.comments),'B cannot read A comments');
select test.assert_true((select count(*)=0 from public.task_assignees),'B cannot read A assignments');
select test.expect_error($q$
 select public.save_task(
  p_task_id=>'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',p_changes=>'{"title":"Cross-owner edit"}',
  p_expected_updated_at=>'2026-01-01'
 )
$q$,'P0002','B cannot edit a known A task through RPC');
delete from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.assert_true(
 exists(select 1 from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
 'A task survives a B delete attempt'
);
delete from public.tasks where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select test.assert_true(
 not exists(select 1 from public.task_activity)
 and not exists(select 1 from public.comments)
 and not exists(select 1 from public.task_assignees),
 'task deletion removes history and children without a terminal event error'
);

-- Privileged cleanup has no guest claim and must tolerate every cascade order.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
insert into public.team_members(id,name)
 values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','Cleanup');
select public.save_task(
 p_task_id=>'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',p_changes=>'{"title":"Cleanup task"}',
 p_assignee_ids=>array['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2']::uuid[]
);
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from auth.users where id='33333333-3333-4333-8333-333333333333';
select test.assert_true(
 not exists(select 1 from public.tasks where user_id='33333333-3333-4333-8333-333333333333')
 and not exists(select 1 from public.task_activity where user_id='33333333-3333-4333-8333-333333333333')
 and not exists(select 1 from public.team_members where user_id='33333333-3333-4333-8333-333333333333')
 and not exists(select 1 from public.task_assignees where user_id='33333333-3333-4333-8333-333333333333'),
 'auth-user cleanup succeeds without a session or orphaned history'
);
select count(*)::text || ' access and mutation checks passed' from test.results;
rollback;
