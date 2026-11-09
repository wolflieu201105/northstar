-- GENERATED Phase 18: revision conflicts return HTTP 409.
begin;

-- Phase 18: business revision conflicts must not trigger PostgREST transaction retries.
-- Preserve the checked private implementation, arguments, grants, and atomic rollback.
-- Public invoker wrappers translate the internal serialization signal into HTTP 409.
create or replace function public.save_task(p_group_id uuid,p_task_id uuid,p_changes jsonb default '{}',
  p_assignee_ids uuid[] default null,p_label_ids uuid[] default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.save_group_task(p_group_id,p_task_id,p_changes,p_assignee_ids,p_label_ids,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

create or replace function public.delete_task(p_group_id uuid,p_task_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.delete_group_task(p_group_id,p_task_id,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

create or replace function public.save_label(p_group_id uuid,p_label_id uuid,p_name text default null,p_color text default null,
  p_archived boolean default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.save_group_label(p_group_id,p_label_id,p_name,p_color,p_archived,p_expected_updated_at);
exception when serialization_failure then
  raise sqlstate 'PT409' using message = sqlerrm;
end;
$$;

notify pgrst, 'reload schema';
commit;
