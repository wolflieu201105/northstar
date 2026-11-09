-- LOCAL SYNTHETIC FIXTURES ONLY. Never run this against a hosted project.
begin;
\ir helpers.sql

select test.assert_true((select count(*)=3 from public.profiles), 'existing Auth users receive real profiles');
select test.assert_true((select count(*)=3 from public.groups), 'each Auth user starts with one private group');
select test.assert_true((select count(*)=3 and bool_and(is_active) from public.group_members), 'private-group owners have active membership');
select test.assert_true(not exists(select 1 from public.tasks) and not exists(select 1 from public.labels)
  and not exists(select 1 from public.comments) and not exists(select 1 from public.task_activity), 'fresh setup/reset contains no old task data');
select test.assert_true(to_regclass('public.team_members') is null and to_regclass('public.task_assignees') is null,
  'no fictitious member or legacy assignment tables');
select test.assert_true(to_regprocedure('public.save_task(uuid,jsonb,uuid[],uuid[],timestamp with time zone)') is null,
  'obsolete owner-only RPC is absent');
select test.assert_true((select count(*)=10 and bool_and(relrowsecurity) from pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'), 'all ten tables have RLS');
select test.assert_true(not exists(select 1 from pg_policies where schemaname='public'), 'no legacy owner policies survive');
select test.assert_true(not exists(
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join unnest(array['anon','authenticated']) role_name
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
  where n.nspname='public' and c.relkind='r' and (
    has_table_privilege(role_name,c.oid,privilege)
    or (privilege<>'DELETE' and has_any_column_privilege(role_name,c.oid,privilege))
  )), 'API access stays closed despite permissive default grants');
select test.assert_true(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array['anon','authenticated','service_role']) role_name
  where n.nspname='private' and has_function_privilege(role_name,p.oid,'EXECUTE')), 'private provisioning helpers cannot be called by API roles');
select test.assert_true(not exists(
  select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.contype='f'
  and not exists(select 1 from pg_index i where i.indrelid=k.conrelid and i.indisvalid
    and i.indpred is null and not exists(select 1 from unnest(k.conkey) with ordinality key(attnum,position)
      where i.indkey[(key.position-1)::int] is distinct from key.attnum))
), 'every foreign key has a leading-column index');

update public.profiles set username='  ALEX  ',display_name='Alex' where id='11111111-1111-4111-8111-111111111111';
select test.assert_true((select username='alex' from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'usernames normalize whitespace and case');
select test.expect_error($q$update public.profiles set username='Alex' where id='22222222-2222-4222-8222-222222222222'$q$,
  '23505','username uniqueness is enforced in the database');
select test.expect_error($q$update public.profiles set username='bad-name' where id='11111111-1111-4111-8111-111111111111'$q$,
  '23514','invalid username characters are rejected');
select test.expect_error($q$update public.profiles set display_name=' ' where id='11111111-1111-4111-8111-111111111111'$q$,
  '23514','blank display names are rejected');
select test.expect_error($q$update public.profiles set avatar_color='url(evil)' where id='11111111-1111-4111-8111-111111111111'$q$,
  '23514','unapproved avatar colors are rejected');
select test.expect_error($q$update public.profiles set created_at=now()-interval '1 day' where id='11111111-1111-4111-8111-111111111111'$q$,
  '42501','profile creation timestamps are immutable');
select private.initialize_account('11111111-1111-4111-8111-111111111111');
select private.initialize_account('11111111-1111-4111-8111-111111111111');
select test.assert_true((select count(*)=3 from public.groups) and (select username='alex' from public.profiles
  where id='11111111-1111-4111-8111-111111111111'), 'provisioning retries preserve chosen profile and do not duplicate groups');

-- Matching username prefixes force the collision-retry path in Auth provisioning.
insert into auth.users(id) values ('44444444-4444-4444-8444-000000000001'),('44444444-4444-4444-8444-000000000002');
select test.assert_true((select count(*)=2 and count(distinct username)=2 and bool_and(length(username)<=30)
  from public.profiles where id in ('44444444-4444-4444-8444-000000000001','44444444-4444-4444-8444-000000000002')),
  'new guests get unique profiles even when generated username prefixes collide');
set constraints groups_active_owner_fkey immediate;
set constraints groups_active_owner_fkey deferred;

create temp table test_groups as select owner_user_id as user_id,id as group_id from public.groups;
select test.expect_error($q$
  insert into public.groups(id,name,owner_user_id,created_by_name) values (
    '99999999-9999-4999-8999-999999999999','No member','11111111-1111-4111-8111-111111111111','Alex');
  set constraints groups_active_owner_fkey immediate;
$q$,'23503','a group cannot commit without an active owner membership');
select test.expect_error($q$
  update public.group_members set is_active=false,left_at=clock_timestamp()
    where user_id='11111111-1111-4111-8111-111111111111';
  set constraints groups_active_owner_fkey immediate;
$q$,'23503','the owner cannot leave without transfer or group deletion');
select test.expect_error($q$delete from auth.users where id='11111111-1111-4111-8111-111111111111'$q$,
  '23503','deleting an Auth owner is blocked until ownership is handled');

insert into public.tasks(id,group_id,title,created_by_user_id,created_by_name)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',group_id,'Shared task',user_id,'Alex'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111';
insert into public.labels(id,group_id,name,created_by_user_id)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',group_id,'Bug',user_id
  from test_groups where user_id='22222222-2222-4222-8222-222222222222';
select test.expect_error($q$insert into public.task_labels(group_id,task_id,label_id)
  select group_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111'$q$,
  '23503','a task cannot link to a label in another group');
select test.expect_error($q$insert into public.task_assignments(group_id,task_id,assignee_user_id)
  select group_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','33333333-3333-4333-8333-333333333333'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111'$q$,
  '23503','outsiders cannot be task assignees');

insert into public.group_invitations(group_id,inviter_user_id,inviter_name,recipient_user_id)
  select group_id,user_id,'Alex','33333333-3333-4333-8333-333333333333'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111';
select test.assert_true(not exists(select 1 from public.group_members m join test_groups g on g.group_id=m.group_id
  where g.user_id='11111111-1111-4111-8111-111111111111' and m.user_id='33333333-3333-4333-8333-333333333333'),
  'a pending invitation creates no membership');
select test.expect_error($q$insert into public.group_invitations(group_id,inviter_user_id,inviter_name,recipient_user_id)
  select group_id,user_id,'Alex','33333333-3333-4333-8333-333333333333'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111'$q$,
  '23505','only one pending invitation per group and recipient');
select test.expect_error($q$update public.group_invitations set status='accepted'$q$,
  '23514','terminal invitation states require response timestamps');
select test.expect_error($q$update public.group_invitations set expires_at=created_at$q$,
  '23514','invitation expiry must follow creation');

insert into public.group_members(group_id,user_id,is_active,left_at)
  select group_id,'22222222-2222-4222-8222-222222222222',false,clock_timestamp()
  from test_groups where user_id='11111111-1111-4111-8111-111111111111';
select test.expect_error($q$insert into public.task_assignments(group_id,task_id,assignee_user_id)
  select group_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111'$q$,
  '23503','inactive members cannot receive new assignments');

-- A member who created shared content can be deleted after their own group is
-- deliberately deleted. Auth/profile cascades remove assignments, not content.
insert into public.group_members(group_id,user_id)
  select group_id,'44444444-4444-4444-8444-000000000001'
  from test_groups where user_id='11111111-1111-4111-8111-111111111111';
update public.tasks set created_by_user_id='44444444-4444-4444-8444-000000000001',created_by_name='Departed user';
insert into public.task_assignments(group_id,task_id,assignee_user_id,assigned_by_user_id)
  select group_id,id,'44444444-4444-4444-8444-000000000001','44444444-4444-4444-8444-000000000001' from public.tasks;
insert into public.comments(group_id,task_id,author_user_id,author_name,body)
  select group_id,id,'44444444-4444-4444-8444-000000000001','Departed user','Keep this comment' from public.tasks;
insert into public.task_activity(group_id,task_id,actor_user_id,actor_name,event_type,payload)
  select group_id,id,'44444444-4444-4444-8444-000000000001','Departed user','task_created','{"version":2,"title":"Shared task","status":"todo"}' from public.tasks;
create temp table saved_content as select updated_at from public.tasks;
delete from public.groups where owner_user_id='44444444-4444-4444-8444-000000000001';
delete from auth.users where id='44444444-4444-4444-8444-000000000001';
select test.assert_true((select count(*)=1 and bool_and(created_by_user_id is null and created_by_name='Departed user') from public.tasks),
  'non-owner account deletion retains shared tasks and historic creator name');
select test.assert_true((select updated_at from public.tasks)=(select updated_at from saved_content), 'account cleanup does not fabricate a task edit timestamp');
select test.assert_true((select count(*)=1 and bool_and(author_user_id is null and author_name='Departed user' and body='Keep this comment') from public.comments),
  'account deletion retains comments and author names');
select test.assert_true((select count(*)=1 and bool_and(actor_user_id is null and actor_name='Departed user' and payload->>'version'='2') from public.task_activity),
  'account deletion retains activity payloads and actor names');
select test.assert_true(not exists(select 1 from public.task_assignments), 'account deletion removes assignments to the deleted member');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.expect_error('select * from public.tasks','42501','even a member cannot use the unfinished Phase 13 task API');
select test.expect_error('select * from public.profiles','42501','global profile browsing is closed');
select test.expect_error($q$select private.initialize_account('11111111-1111-4111-8111-111111111111')$q$,
  '42501','a client cannot call privileged account initialization');
reset role;

delete from public.groups where owner_user_id='11111111-1111-4111-8111-111111111111';
select test.assert_true(not exists(select 1 from public.tasks) and not exists(select 1 from public.comments)
  and not exists(select 1 from public.task_activity) and not exists(select 1 from public.group_invitations),
  'group deletion removes its task and invitation children without orphans');
select test.assert_true((select count(*)=1 from public.labels), 'deleting one group preserves another group data');
select count(*)::text || ' group foundation checks passed' from test.results;
rollback;
