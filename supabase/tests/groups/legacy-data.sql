-- Disposable reset test only: every row in this fixture MUST be discarded.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.team_members(id,name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Legacy placeholder');
insert into public.labels(id,name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','Legacy label');
insert into public.task_assignees(task_id,member_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
insert into public.task_labels(task_id,label_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
insert into public.comments(task_id,body) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Discard this legacy comment.');
insert into public.task_activity(task_id,event_type,payload) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','task_created','{"retired":true}');
select set_config('request.jwt.claim.sub','',false);
