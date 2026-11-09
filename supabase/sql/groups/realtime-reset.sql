-- Reset-only cleanup; never run this alone on an existing group database.
drop policy if exists northstar_broadcast_read on realtime.messages;
drop policy if exists northstar_broadcast_anon_scope on realtime.messages;
drop policy if exists northstar_broadcast_scope on realtime.messages;
drop policy if exists northstar_broadcast_no_client_send on realtime.messages;
drop function if exists private.can_receive_workspace_changes(text);
drop function if exists private.broadcast_workspace_change() cascade;
drop function if exists private.emit_workspace_change(text,text);
