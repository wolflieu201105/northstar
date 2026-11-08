-- Synthetic pre-upgrade data only. Sentinel timestamps catch accidental backfills.
insert into public.tasks (
  id, user_id, title, description, status, priority, due_date, created_at, updated_at
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'Existing task A', 'Preserve this description.', 'in_progress', 'high',
    '2026-12-15', '2026-01-01 10:00:00+00', '2026-01-02 11:00:00+00'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '22222222-2222-4222-8222-222222222222',
    'Existing task B', null, 'done', 'low', null,
    '2026-02-01 12:00:00+00', '2026-02-02 13:00:00+00'
  );

create table test.expected_tasks as select * from public.tasks;
