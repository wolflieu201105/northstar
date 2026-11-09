-- Phase 13: membership helpers and the serialized mutation boundary.
create table if not exists private.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key(user_id,bucket,window_start)
);
alter table private.api_rate_limits enable row level security;
revoke all on private.api_rate_limits from public, anon, authenticated, service_role;

create or replace function private.current_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor) then
    raise exception 'A current account is required.' using errcode='42501';
  end if;
  return actor;
end;
$$;

create or replace function private.has_group_access(target_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(
    select 1 from public.group_members m join public.profiles p on p.id=m.user_id
    where m.group_id=target_group and m.user_id=auth.uid() and m.is_active
  );
$$;

create or replace function private.can_read_profile(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid())
    and (target_user=auth.uid() or exists(
      select 1 from public.group_members mine join public.group_members theirs on theirs.group_id=mine.group_id
      where mine.user_id=auth.uid() and mine.is_active and theirs.user_id=target_user
    ));
$$;

create or replace function private.can_read_invitation(target_group uuid, sender uuid, recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid())
    and (recipient=auth.uid() or (private.has_group_access(target_group)
      and (sender=auth.uid() or exists(select 1 from public.groups where id=target_group and owner_user_id=auth.uid()))));
$$;

-- Every group mutation takes this parent lock BEFORE task/member/invite locks.
-- Small-group writes serialize, including edits versus removal and accept/revoke.
create or replace function private.lock_group(target_group uuid, owner_only boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_actor(); group_owner uuid;
begin
  select owner_user_id into group_owner from public.groups where id=target_group for update;
  if not found or not private.has_group_access(target_group) or (owner_only and group_owner<>actor) then
    raise exception 'Group is unavailable or this action is not allowed.' using errcode='42501';
  end if;
  return actor;
end;
$$;

create or replace function private.consume_api_budget(action_name text, allowed integer, period interval)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_actor(); start_time timestamptz; used integer;
begin
  -- A fixed UTC origin prevents a request/session timezone from shifting quotas.
  start_time := date_bin(period,clock_timestamp(),'2000-01-01 00:00:00+00'::timestamptz);
  delete from private.api_rate_limits where user_id=actor and bucket=action_name and window_start<start_time;
  insert into private.api_rate_limits(user_id,bucket,window_start,hits) values(actor,action_name,start_time,1)
    on conflict(user_id,bucket,window_start) do update set hits=private.api_rate_limits.hits+1 returning hits into used;
  if used>allowed then raise exception 'Too many requests. Try again later.' using errcode='54000'; end if;
end;
$$;

revoke all on function private.current_actor(), private.has_group_access(uuid), private.can_read_profile(uuid),
  private.can_read_invitation(uuid,uuid,uuid), private.lock_group(uuid,boolean),
  private.consume_api_budget(text,integer,interval) from public, anon, authenticated, service_role;

-- Only these predicates are client-callable; they reveal the caller's own access.
grant usage on schema private to authenticated;
grant execute on function private.has_group_access(uuid), private.can_read_profile(uuid),
  private.can_read_invitation(uuid,uuid,uuid) to authenticated;
