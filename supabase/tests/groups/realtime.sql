-- LOCAL ONLY: real PostgreSQL RLS and transactional queue fixture; not WebSocket delivery.
begin;
\ir helpers.sql
select test.expect_error('alter table realtime.messages enable row level security','42501',
  'managed-table ownership guard rejects redundant ALTER TABLE even for the test superuser');
select test.assert_true((select count(*)=4 from pg_policies where schemaname='realtime' and tablename='messages' and policyname like 'northstar_%'),'four namespace-scoped Broadcast policies');
select test.assert_true(not has_function_privilege('authenticated','private.emit_workspace_change(text,text)','EXECUTE')
  and not has_function_privilege('anon','private.can_receive_workspace_changes(text)','EXECUTE'),'notification writers and guestless authorization are closed');
select test.assert_true((select count(*)=10 from pg_trigger where tgname='northstar_broadcast_change' and not tgisinternal),'all application tables emit invalidations');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_group('Live group','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17');
select test.assert_true(private.can_receive_workspace_changes('northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'active owner can subscribe to group');
select test.assert_true(private.can_receive_workspace_changes('northstar:account:11111111-1111-4111-8111-111111111111'),'account channel belongs to its authenticated UUID');
select test.assert_true(not private.can_receive_workspace_changes('northstar:account:22222222-2222-4222-8222-222222222222'),'another account channel is denied');
select test.assert_true(not private.can_receive_workspace_changes('northstar:group:not-a-uuid')
  and not private.can_receive_workspace_changes('unknown:topic'),'malformed and foreign namespace topics are denied safely');
select public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb17',
  '{"title":"Confidential task content"}');
reset role;
select test.assert_true((select count(*)>0 and bool_and(private and payload='{}'::jsonb) from realtime.messages),'only private empty invalidations are queued');
select test.assert_true(not exists(select 1 from realtime.messages where payload::text like '%Confidential%'),'no task contents enter messages');
select test.assert_true(exists(select 1 from realtime.messages where topic='northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17' and event='board'),'task changes invalidate the scoped board');
select test.assert_true(exists(select 1 from realtime.messages where topic='northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17' and event='discussion'),'committed activity invalidates discussion');

-- Prove a future broad policy for another app cannot open Northstar topics or sending.
create policy test_external_read on realtime.messages for select to authenticated using (true);
create policy test_external_send on realtime.messages for insert to authenticated with check (true);
select realtime.send('{}','external','external-app',true);
create policy test_external_anon_read on realtime.messages for select to anon using (true);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('realtime.topic','northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',true);
select test.assert_true(not exists(select 1 from realtime.messages where topic like 'northstar:%'),'anonymous API role remains denied despite an external broad policy');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('realtime.topic','northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',true);
select test.assert_true(not private.can_receive_workspace_changes('northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'outsider cannot join the group channel');
select test.assert_true(not exists(select 1 from realtime.messages where topic like 'northstar:%'),'broad external read policy cannot bypass Northstar authorization');
select test.assert_true(exists(select 1 from realtime.messages where topic='external-app'),'other application topics keep their existing policy behavior');
select test.expect_error($q$insert into realtime.messages(topic,event) values('northstar:account:22222222-2222-4222-8222-222222222222','board')$q$,
  '42501','clients cannot forge invalidations even with an external permissive insert policy');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.send_group_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccc17');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('realtime.topic','northstar:account:22222222-2222-4222-8222-222222222222',true);
select test.assert_true(exists(select 1 from realtime.messages where event='invitations' and topic='northstar:account:22222222-2222-4222-8222-222222222222'),'pending recipient receives its own inbox invalidation');
select test.assert_true(not private.can_receive_workspace_changes('northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'pending invitation still grants no group subscription');
select public.respond_group_invitation('cccccccc-cccc-4ccc-8ccc-cccccccccc17',true);
select test.assert_true(private.can_receive_workspace_changes('northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'recipient acceptance permits group subscription');
select set_config('realtime.topic','northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',true);
select test.assert_true(exists(select 1 from realtime.messages where topic='northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'member can receive its joined group notifications');
select test.assert_true(not exists(select 1 from realtime.messages where topic like 'northstar:account:%'),'group topic setting cannot read other account queues');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.remove_group_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','22222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select test.assert_true(not private.can_receive_workspace_changes('northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'unchanged JWT loses group subscription authorization after removal');
select test.assert_true(not exists(select 1 from realtime.messages where topic='northstar:group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'),'removed member cannot read group queue rows');
select set_config('realtime.topic','northstar:account:22222222-2222-4222-8222-222222222222',true);
select test.assert_true(exists(select 1 from realtime.messages where topic='northstar:account:22222222-2222-4222-8222-222222222222' and event='directory'),'removed member can still receive its independent access-loss hint');

reset role;
select set_config('test.queue_count',(select count(*)::text from realtime.messages),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select test.expect_error($q$do $body$ begin
  perform public.save_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','dddddddd-dddd-4ddd-8ddd-dddddddddd17','{"title":"Rolled back"}');
  raise exception 'rollback test';
end $body$$q$,'P0001','synthetic operation rolls back');
reset role;
select test.assert_true((select count(*)::text=current_setting('test.queue_count') from realtime.messages),'rollback leaves no queued success notification');
select test.assert_true(not exists(select 1 from public.tasks where id='dddddddd-dddd-4ddd-8ddd-dddddddddd17'),'rolled-back content is absent too');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
reset role;
create or replace function realtime.send(payload jsonb,event text,topic text,private boolean default true)
returns void language plpgsql as $$begin raise exception 'Simulated notification outage'; end;$$;
select set_config('test.outage_queue',(select count(*)::text from realtime.messages),true);
set local role authenticated;
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb17','Saved during an outage','eeeeeeee-eeee-4eee-8eee-eeeeeeeeee17');
select test.assert_true(exists(select 1 from public.comments where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeee17'),'notification failure does not roll back committed user work');
reset role;
select test.assert_true((select count(*)::text=current_setting('test.outage_queue') from realtime.messages),'notification outage queues no fabricated success');
create or replace function realtime.send(payload jsonb,event text,topic text,private boolean default true)
returns void language sql as $$insert into realtime.messages(payload,event,topic,private) values(payload,event,topic,private)$$;
set local role authenticated;
select public.delete_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb17',
  (select updated_at from public.tasks where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb17'));
select public.delete_group('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17');
reset role;
select test.assert_true(exists(select 1 from realtime.messages where topic='northstar:account:11111111-1111-4111-8111-111111111111' and event='directory'),'group deletion signals the independent account directory');
select test.assert_true(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'),'application tables are not added to Postgres Changes');
select count(*) || ' realtime security and transaction checks passed' from test.results;
rollback;
