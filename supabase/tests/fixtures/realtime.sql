-- LOCAL ONLY. Models transactional queue inserts and PostgreSQL RLS; no WebSocket server.
create schema realtime;
create table realtime.messages (
  id uuid primary key default gen_random_uuid(), topic text not null, extension text not null default 'broadcast',
  payload jsonb not null default '{}', event text not null, private boolean not null default true
);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select current_setting('realtime.topic',true)
$$;
create function realtime.send(payload jsonb,event text,topic text,private boolean default true)
returns void language sql as $$
  insert into realtime.messages(payload,event,topic,private) values(payload,event,topic,private)
$$;
grant usage on schema realtime to authenticated, anon;
grant select,insert on realtime.messages to authenticated,anon;
grant execute on function realtime.topic() to authenticated,anon;
revoke all on function realtime.send(jsonb,text,text,boolean) from public, authenticated,anon;

-- Emulate the managed-table restriction even when tests connect as a local superuser.
-- Supabase delegates policy DDL on messages through supautils, but not ALTER TABLE.
create function test.guard_managed_realtime_table() returns event_trigger
language plpgsql as $$
declare command record;
begin
  for command in select * from pg_event_trigger_ddl_commands() loop
    if command.command_tag='ALTER TABLE' and command.classid='pg_class'::regclass
      and command.objid='realtime.messages'::regclass then
      raise exception 'must be owner of table messages (managed Realtime fixture)' using errcode='42501';
    end if;
  end loop;
end;
$$;
create event trigger test_managed_realtime_guard on ddl_command_end
execute function test.guard_managed_realtime_table();
