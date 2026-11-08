-- LOCAL SYNTHETIC FIXTURES ONLY. All mutations in this file are rolled back.
begin;

create table test.results (name text primary key);

create function test.assert_true(condition boolean, test_name text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'FAIL: %', test_name;
  end if;
  insert into test.results values (test_name);
end;
$$;

create function test.expect_error(statement text, expected_state text, test_name text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_state then
      raise exception 'FAIL: % (expected %, received %: %)',
        test_name, expected_state, sqlstate, sqlerrm;
    end if;
    insert into test.results values (test_name);
    return;
  end;
  raise exception 'FAIL: % (expected error %)', test_name, expected_state;
end;
$$;

select test.assert_true(
  (select jsonb_agg(to_jsonb(t) order by id) from public.tasks t) =
  (select jsonb_agg(to_jsonb(t) order by id) from test.expected_tasks t),
  'all existing task fields and timestamps are preserved'
);

select test.assert_true(
  not exists (select 1 from public.team_members)
  and not exists (select 1 from public.labels)
  and not exists (select 1 from public.task_assignees)
  and not exists (select 1 from public.task_labels)
  and not exists (select 1 from public.comments)
  and not exists (select 1 from public.task_activity),
  'upgrade creates no fake profiles, relations, comments, or history'
);

select test.assert_true(
  (select count(*) = 6 and bool_and(c.relrowsecurity)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'team_members', 'labels', 'task_assignees', 'task_labels', 'comments', 'task_activity'
   )),
  'all new tables have RLS enabled'
);

select test.assert_true(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'team_members', 'labels', 'task_assignees', 'task_labels', 'comments', 'task_activity'
    ]) table_name
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) privilege
    where has_table_privilege(role_name, 'public.' || table_name, privilege)
       or (privilege <> 'DELETE' and has_any_column_privilege(
         role_name, 'public.' || table_name, privilege
       ))
  ),
  'API roles have no new-table privileges before Phase 3'
);

select test.assert_true(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join unnest(array['anon', 'authenticated', 'service_role']) role_name
    where n.nspname = 'private' and has_function_privilege(role_name, p.oid, 'EXECUTE')
  ),
  'API roles cannot directly execute private trigger helpers'
);

select test.assert_true(
  not exists (
    select 1 from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and k.contype = 'f'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = k.conrelid and i.indisvalid and i.indisready
          and i.indpred is null
          and not exists (
            select 1 from unnest(k.conkey) with ordinality key(attnum, position)
            where i.indkey[(key.position - 1)::int] is distinct from key.attnum
          )
      )
  ),
  'every foreign-key lookup has an index with the same leading columns'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

insert into public.team_members (id, name, avatar_color) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Alex', '#20895b'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Alex', null);
insert into public.labels (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Bug'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Design');

select test.assert_true(
  (select count(*) = 2 from public.team_members where name = 'Alex'),
  'members with the same name have separate identities'
);
select test.assert_true(
  (select bool_and(user_id = '11111111-1111-4111-8111-111111111111')
   from public.team_members),
  'record owner defaults to the current authenticated identity'
);

select test.expect_error(
  'insert into public.team_members(name) values (E''\t\n'')', '23514',
  'whitespace-only member names are rejected'
);
select test.expect_error(
  'insert into public.team_members(name) values ('' Alex '')', '23514',
  'member names must be trimmed'
);
select test.expect_error(
  'insert into public.team_members(name) values (repeat(''x'', 81))', '23514',
  'member names have an 80-character limit'
);
select test.expect_error(
  'insert into public.team_members(name, avatar_color) values (''Sam'', ''url(evil)'')',
  '23514', 'arbitrary avatar CSS is rejected'
);
select test.expect_error(
  'insert into public.labels(name) values (''bug'')', '23505',
  'label names are case-insensitively unique per owner'
);
select test.expect_error(
  'insert into public.labels(name) values (E''\n'')', '23514',
  'whitespace-only labels are rejected'
);
select test.expect_error(
  'insert into public.labels(name) values (repeat(''x'', 41))', '23514',
  'label names have a 40-character limit'
);
select test.expect_error(
  'insert into public.labels(name, color) values (''Feature'', ''purple'')', '23514',
  'label colors must come from the approved palette'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
insert into public.team_members (id, name) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Jordan');
insert into public.labels (id, name) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'Bug');
select test.assert_true(
  (select count(*) = 2 from public.labels where name = 'Bug'),
  'different owners may use the same label name'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into public.task_assignees (task_id, member_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
insert into public.task_labels (task_id, label_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5');

select test.assert_true(
  (select count(*) = 2 from public.task_assignees)
  and (select count(*) = 2 from public.task_labels),
  'one task supports multiple assignees and multiple labels'
);
select test.expect_error(
  'insert into public.task_assignees(task_id, member_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'')',
  '23505', 'duplicate assignee links are rejected'
);
select test.expect_error(
  'insert into public.task_labels(task_id, label_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'')',
  '23505', 'duplicate label links are rejected'
);

select test.expect_error(
  'insert into public.task_assignees(task_id, member_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'')',
  '23503', 'owner A cannot link a member belonging to B'
);
select test.expect_error(
  'insert into public.task_assignees(task_id, member_id) values
   (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'')',
  '23503', 'owner A cannot link an A member to a task belonging to B'
);
select test.expect_error(
  'insert into public.task_labels(task_id, label_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'')',
  '23503', 'owner A cannot link a label belonging to B'
);
select test.expect_error(
  'insert into public.task_labels(task_id, label_id) values
   (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'')',
  '23503', 'owner A cannot link an A label to a task belonging to B'
);

update public.team_members set archived_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
update public.labels set archived_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
select test.assert_true(
  (select count(*) = 2 from public.task_assignees)
  and (select count(*) = 2 from public.task_labels),
  'archiving retains existing task links'
);
select test.expect_error(
  'insert into public.labels(name) values (''design'')', '23505',
  'archived labels keep their normalized names reserved'
);
delete from public.task_assignees where member_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
delete from public.task_labels where label_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
select test.expect_error(
  'insert into public.task_assignees(task_id, member_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'')',
  '23514', 'archived members cannot be added to tasks'
);
select test.expect_error(
  'insert into public.task_labels(task_id, label_id) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'')',
  '23514', 'archived labels cannot be added to tasks'
);
update public.team_members set archived_at = null
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
insert into public.task_assignees(task_id, member_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
select test.assert_true(
  (select count(*) = 2 from public.task_assignees),
  'restoring a member makes them assignable again'
);

select test.expect_error(
  'update public.team_members set user_id = ''22222222-2222-4222-8222-222222222222''
   where id = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2''',
  '42501', 'member ownership cannot be rewritten'
);
select test.expect_error(
  'update public.labels set created_at = ''2000-01-01''
   where id = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4''',
  '42501', 'label creation timestamps cannot be rewritten'
);
update public.team_members set avatar_color = '#166b45', updated_at = '2000-01-01'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
select test.assert_true(
  (select updated_at = now() from public.team_members
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  'metadata updates stamp updated_at on the server'
);
select test.expect_error(
  'update public.task_assignees set created_at = ''2000-01-01''', '42501',
  'relationship records cannot be updated in place'
);

select test.expect_error(
  'insert into public.comments(task_id, body) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', E''\t\n  '')',
  '23514', 'whitespace-only comments are rejected'
);
select test.expect_error(
  'insert into public.comments(task_id, body) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', repeat(''x'', 2001))',
  '23514', 'comment bodies have a 2000-character limit'
);
select test.expect_error(
  'insert into public.comments(task_id, body) values
   (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'', ''Cross-owner attempt'')',
  '23503', 'comments must reference a task with the same owner'
);
insert into public.comments(task_id, body) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', E'First line\nSecond line');
select test.expect_error(
  'update public.comments set body = ''Rewritten''', '42501',
  'comments are append-only in this version'
);

select test.expect_error(
  'insert into public.task_activity(task_id, event_type) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''made_up_event'')',
  '23514', 'activity event types are validated'
);
select test.expect_error(
  'insert into public.task_activity(task_id, event_type, payload) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''task_edited'', ''[]''::jsonb)',
  '23514', 'activity payloads must be JSON objects'
);
select test.expect_error(
  'insert into public.task_activity(task_id, actor_user_id, event_type) values
   (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'', ''22222222-2222-4222-8222-222222222222'', ''task_edited'')',
  '23514', 'activity actor must match the guest owner'
);
select test.expect_error(
  'insert into public.task_activity(task_id, event_type) values
   (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'', ''task_edited'')',
  '23503', 'activity must reference a task with the same owner'
);
insert into public.task_activity(task_id, event_type, payload) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'task_edited', '{"fields":["title"]}');
select test.expect_error(
  'update public.task_activity set payload = ''{}''', '42501',
  'activity entries cannot be rewritten'
);

delete from public.tasks where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select test.assert_true(
  not exists (select 1 from public.task_assignees)
  and not exists (select 1 from public.task_labels)
  and not exists (select 1 from public.comments)
  and not exists (select 1 from public.task_activity),
  'task deletion cascades all its child records'
);
select test.assert_true(
  (select count(*) = 3 from public.team_members)
  and (select count(*) = 3 from public.labels),
  'task deletion preserves reusable members and labels'
);

-- A separate owner exercises all direct and indirect auth-user cascade paths.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into public.tasks (id, title) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Cleanup test');
insert into public.team_members (id, name) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'Casey');
insert into public.labels (id, name) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'Cleanup');
insert into public.task_assignees (task_id, member_id) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2');
insert into public.task_labels (task_id, label_id) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4');
insert into public.comments (task_id, body) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Cleanup comment');
insert into public.task_activity (task_id, event_type) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'task_created');
delete from auth.users where id = '33333333-3333-4333-8333-333333333333';
select test.assert_true(
  not exists (select 1 from public.tasks where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.team_members where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.labels where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.task_assignees where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.task_labels where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.comments where user_id = '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.task_activity where user_id = '33333333-3333-4333-8333-333333333333'),
  'auth-user deletion removes all owned records without cascade failures'
);

select count(*)::text || ' schema checks passed' as result from test.results;
rollback;
