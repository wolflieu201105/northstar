-- LOCAL ONLY: simulated JWT claims exercise real PostgreSQL roles/RLS/RPCs.
begin;
\ir helpers.sql
create function test.token(task uuid) returns timestamptz language sql as $$select updated_at from public.tasks where id=task$$;
grant execute on function test.token(uuid) to authenticated;
update public.profiles set display_name=case id when '11111111-1111-4111-8111-111111111111' then 'Alex'
  when '22222222-2222-4222-8222-222222222222' then 'Sam' else 'Riley' end;
update public.profiles set username=case id when '11111111-1111-4111-8111-111111111111' then 'alex'
  when '22222222-2222-4222-8222-222222222222' then 'sam' else 'riley' end;

select test.assert_true(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.prorettype<>'event_trigger'::regtype), 'no public SECURITY DEFINER APIs');
select test.assert_true(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and (has_function_privilege('anon',p.oid,'EXECUTE') or exists(
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'))),
  'unauthenticated roles cannot call private APIs or helpers');
select test.assert_true(not has_function_privilege('authenticated','private.append_task_event(uuid,uuid,text,jsonb,boolean)','EXECUTE')
  and not has_function_privilege('authenticated','private.consume_api_budget(text,integer,interval)','EXECUTE'), 'history writer and quota controls are not client endpoints');
select test.assert_true((select count(*)=11 from pg_policies where schemaname='public'), 'ten read policies plus own-profile update');
select test.assert_true(not exists(select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and k.contype='f'
  and not exists(select 1 from pg_index i where i.indrelid=k.conrelid and i.indisvalid and i.indpred is null
    and not exists(select 1 from unnest(k.conkey) with ordinality key(attnum,position)
      where i.indkey[(key.position-1)::int] is distinct from key.attnum))), 'all access and cascade foreign keys have indexes');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_group('Project G','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0');
select public.create_group('Retry name ignored','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0');
select test.assert_true((select name='Project G' from public.groups where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'group creation retry does not overwrite a group');
select test.assert_true((select count(*)=1 from public.profiles), 'profiles do not expose a global directory');
select test.assert_true(public.lookup_invitation_target('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222')->>'display_name'='Sam', 'exact ID lookup resolves an existing account');
select test.assert_true(public.lookup_invitation_target('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','  SAM  ')->>'id'='22222222-2222-4222-8222-222222222222'
  and not(public.lookup_invitation_target('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','sam') ? 'email'), 'username lookup is exact normalized and excludes email');
select test.assert_true(not(public.lookup_invitation_target('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','not_a_user') is not null), 'unknown account lookup returns no account');
update public.profiles set username='alex',display_name='Alex updated' where id='11111111-1111-4111-8111-111111111111';
select test.expect_error($q$update public.profiles set id='33333333-3333-4333-8333-333333333333'$q$,'42501','profile identity update is not granted');
select test.expect_error($q$insert into public.group_members(group_id,user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222')$q$,
  '42501','members cannot bypass invitation acceptance by direct insertion');
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
select test.assert_true((public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3')->>'status')='pending', 'invitation send retries are idempotent');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select test.expect_error($q$select public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true)$q$,'42501','only the recipient can accept');
select test.expect_error($q$select public.revoke_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3')$q$,'42501','outsiders cannot revoke invitations');
select test.expect_error($q$select public.lookup_invitation_target('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','alex')$q$,'42501','outsiders cannot use a group for account lookup');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":"Forgery"}')$q$,
  '42501','outsiders cannot create group tasks');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.assert_true(not exists(select 1 from public.groups where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'a pending invite grants no group row access');
select test.assert_true((public.list_group_invitations()->0->>'group_name')='Project G', 'recipient can read the minimal invitation preview');
select test.assert_true((public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true)->>'status')='accepted', 'recipient accepts and joins atomically');
select public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true);
select test.assert_true((select count(*)=1 from public.group_members where group_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0' and user_id='22222222-2222-4222-8222-222222222222'), 'accept retries never duplicate membership');
select test.assert_true((select count(*)=2 from public.profiles), 'members can see fellow group profiles');
update public.profiles set display_name='Cannot rename others' where id='11111111-1111-4111-8111-111111111111';
select test.assert_true((select display_name='Alex updated' from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'zero-row profile updates cannot edit another member');
select public.create_group('Private H','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0');
select public.save_label('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','Private label');
select test.expect_error($q$select public.delete_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0')$q$,'42501','ordinary members cannot delete groups');
select test.expect_error($q$select private.group_operation(null,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','{"user_id":"11111111-1111-4111-8111-111111111111"}')$q$,
  '22023','null private dispatch cannot bypass owner checks');
select test.expect_error('select public.list_group_invitations(null)','22023','null page size cannot remove the inbox limit');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.assert_true(not exists(select 1 from public.labels where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 'a member cannot read another private group labels');
select public.save_label('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Bug');
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":"Shared task","due_date":"2026-11-09"}');
select test.assert_true((select created_by_user_id='11111111-1111-4111-8111-111111111111' and created_by_name='Alex updated' from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'task attribution comes from the real current profile');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"actor_user_id":"33333333-3333-4333-8333-333333333333"}',null,null,test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))$q$,
  '22023','task JSON cannot forge actor or protected fields');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":17}',null,null,test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))$q$,
  '22023','invalid field types are rejected');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"status":"in_progress","description":"Member edit"}',
  array['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222']::uuid[],
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'));
select test.assert_true((select count(*)=2 from public.task_assignments where group_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'members assign multiple actual users with duplicates normalized');
select test.assert_true((select count(*)=6 from public.task_activity where task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'creation status edit assignments and labels append committed events once');
select test.assert_true((select actor_name='Sam' and actor_user_id='22222222-2222-4222-8222-222222222222' from public.task_activity where event_type='status_changed' and task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'edits record the actual member instead of the creator');
create temp table before_noop as select updated_at,(select count(*) from public.task_activity) as events from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"status":"in_progress"}',
  array['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']::uuid[],
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'));
select test.assert_true((select updated_at from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')=(select updated_at from before_noop)
  and (select count(*) from public.task_activity)=(select events from before_noop), 'no-op saves preserve both exact token and history');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":"Do not keep"}',
  array['33333333-3333-4333-8333-333333333333']::uuid[],null,test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))$q$,'42501','foreign assignee rejects the entire save');
select test.assert_true((select title='Shared task' from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
  and (select count(*) from public.task_activity)=(select events from before_noop), 'a failed save appends no success history or scalar edits');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":"Stale"}',null,null,'2020-01-01')$q$,
  '40001','stale task tokens reject overwrites');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{}')$q$,
  '40001','existing tasks require an exact token even for an otherwise empty save');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{}',array[null]::uuid[],null,test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))$q$,
  '22023','null relationship IDs are rejected');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{}',null,
  array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2']::uuid[],test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))$q$,'42501','even a caller belonging to both groups cannot link a foreign label');
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Member comment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5');
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Member comment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5');
select test.assert_true((select count(*)=1 and bool_and(author_name='Sam') from public.comments), 'comment retries retain a single actual author');
select test.expect_error($q$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',' ','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6')$q$,
  '23514','blank comments are rejected');
select test.expect_error($q$insert into public.task_activity(group_id,task_id,actor_name,event_type,payload) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Fake','task_created','{}')$q$,
  '42501','direct activity forgery is denied');
select test.expect_error($q$update public.comments set body='Rewrite'$q$,'42501','comment updates are not granted');
select test.expect_error($q$delete from public.task_activity$q$,'42501','history deletion is not granted');
select public.save_label('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',p_archived=>true,
  p_expected_updated_at=>(select updated_at from public.labels where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'));
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7','{"title":"Archived rejection"}',null,array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[])$q$,
  '42501','archived labels cannot be newly attached');
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{}',null,
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2']::uuid[],test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'));
select test.assert_true((select count(*)=1 from public.task_labels where task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'existing archived links remain valid');
select test.expect_error($q$select public.save_label('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8','BUG')$q$,
  '23505','label names are case-insensitively unique within a group');
select test.expect_error($q$select public.delete_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','2020-01-01')$q$,
  '40001','stale task deletion is rejected');
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7','{"title":"Delete as member"}');
select public.delete_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',test.token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7'));
select test.assert_true(not exists(select 1 from public.task_activity where task_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7'), 'any active member may delete tasks with their history cascaded');
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select test.assert_true((public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',false)->>'status')='declined', 'ordinary members can send requests that recipients decline');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9');
reset role;
update public.group_invitations set created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day'
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select test.assert_true((public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',true)->>'status')='expired', 'expired acceptance resolves without membership');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10');
select public.leave_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select test.assert_true((public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',true)->>'status')='revoked', 'a departed sender cannot admit a pending invitee');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true);
select test.assert_true(not exists(select 1 from public.groups where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'replaying an accepted invite cannot reactivate a departed member');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.respond_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',true);
select test.assert_true(exists(select 1 from public.groups where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'only a new accepted request reactivates membership');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.transfer_group_ownership('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','22222222-2222-4222-8222-222222222222');
select test.expect_error($q$select public.delete_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0')$q$,'42501','the former owner loses owner privileges');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.expect_error($q$select public.leave_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0')$q$,'22023','the current owner must transfer before leaving');
select public.remove_group_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','11111111-1111-4111-8111-111111111111');
select test.assert_true(not exists(select 1 from public.task_assignments where assignee_user_id='11111111-1111-4111-8111-111111111111'), 'removal clears active assignments');
select test.assert_true(exists(select 1 from public.task_activity where event_type='assignee_removed'
  and actor_name='Sam' and payload->>'assignee_name'='Alex updated'), 'removal activity preserves the actual actor and target name');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.assert_true(not exists(select 1 from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'a removed creator loses read access with the same token');
select test.expect_error($q$select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','{"title":"Return"}')$q$,
  '42501','creator attribution does not restore removed access');

-- Per-account limits cover unknown exact lookups and repeated completed invites.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$declare own_group uuid; i integer; request jsonb; previous_timezone text:=current_setting('TimeZone');
begin
  select id into own_group from public.groups where owner_user_id=auth.uid();
  for i in 1..30 loop perform public.lookup_invitation_target(own_group,'no_such_user'); end loop;
  perform test.expect_error(format('select public.lookup_invitation_target(%L,%L)',own_group,'no_such_user'),'54000','unknown lookups are database-rate-limited');
  for i in 1..20 loop
    perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
    request:=public.send_group_invitation(own_group,'11111111-1111-4111-8111-111111111111');
    perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
    perform public.respond_group_invitation((request->>'id')::uuid,false);
  end loop;
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
  perform test.expect_error(format('select public.send_group_invitation(%L,%L)',own_group,'11111111-1111-4111-8111-111111111111'),'54000','invitation sends have an independent database limit');
  perform set_config('TimeZone','Asia/Kathmandu',true);
  perform test.expect_error(format('select public.send_group_invitation(%L,%L)',own_group,'11111111-1111-4111-8111-111111111111'),'54000','timezone preferences cannot reset invitation quotas');
  perform set_config('TimeZone',previous_timezone,true);
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into auth.users(id) values('44444444-4444-4444-8444-444444444444');
update public.profiles set display_name='Devon' where id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','44444444-4444-4444-8444-444444444444','dddddddd-dddd-4ddd-8ddd-ddddddddddd3');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.respond_group_invitation('dddddddd-dddd-4ddd-8ddd-ddddddddddd3',true);
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','{"title":"Keep after account removal"}',array['44444444-4444-4444-8444-444444444444']::uuid[]);
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','Retained comment','dddddddd-dddd-4ddd-8ddd-ddddddddddd5');
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','33333333-3333-4333-8333-333333333333','dddddddd-dddd-4ddd-8ddd-ddddddddddd6');
select public.delete_group((select id from public.groups where owner_user_id=auth.uid()));
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from auth.users where id='44444444-4444-4444-8444-444444444444';
select test.assert_true((select created_by_user_id is null and created_by_name='Devon' from public.tasks where id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 'Auth cleanup retains shared tasks and creator snapshot');
select test.assert_true((select author_user_id is null and author_name='Devon' from public.comments where id='dddddddd-dddd-4ddd-8ddd-ddddddddddd5'), 'Auth cleanup preserves comments with append-only guards installed');
select test.assert_true(exists(select 1 from public.task_activity where task_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  and event_type='assignee_removed' and actor_user_id is null and actor_name='System' and payload->>'assignee_name'='Devon'), 'account cleanup records a named system removal without impersonating a user');
select test.assert_true(exists(select 1 from public.task_activity where task_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  and event_type='task_created' and actor_user_id is null and actor_name='Devon'), 'Auth cleanup preserves historic real actor names');
select test.expect_error($q$update public.task_activity set payload='{}'$q$,'42501','even privileged ordinary updates cannot rewrite append-only history');

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select test.assert_true(exists(select 1 from jsonb_array_elements(public.list_group_invitations(100)) request
  where request->>'id'='dddddddd-dddd-4ddd-8ddd-ddddddddddd6' and request->>'status'='revoked'), 'deleted senders appear revoked in the invitation inbox');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.assert_true(public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0','33333333-3333-4333-8333-333333333333','dddddddd-dddd-4ddd-8ddd-ddddddddddd7')->>'id'='dddddddd-dddd-4ddd-8ddd-ddddddddddd7',
  'a deleted sender cannot leave a stale pending request blocking re-invitation');
reset role;

set local role anon;
select test.expect_error('select * from public.tasks','42501','API-key-only clients cannot read tasks');
select test.expect_error($q$select public.create_group('Unauthenticated')$q$,'42501','API-key-only clients cannot invoke mutations');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select test.assert_true((select count(*)=0 from public.tasks), 'a deleted account token cannot read cached memberships');
select test.expect_error($q$select public.create_group('Deleted account')$q$,'42501','a deleted account token cannot mutate');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.delete_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0');
select test.assert_true(not exists(select 1 from public.task_activity where group_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0'), 'authorized group deletion tolerates all audit cascade orders');
reset role;
select count(*)::text || ' group access and mutation checks passed' from test.results;
rollback;
