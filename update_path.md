# Current update path

The full numbered plan remains in [path-updates.md](path-updates.md).

- **Phases 12–13:** group SQL verified by the user.
- **Phases 14–16:** accounts, guest registration, groups/invitations, and scoped task work implemented. The user reported the account setup working.
- **Phase 17:** private live updates, background reconciliation, reconnect recovery, and periodic access checks implemented and tested locally.
- **SQL now:** run [the additive Phase 17 migration](supabase/migrations/20261109141005_add_private_workspace_realtime.sql), then [verify-phase17.sql](supabase/verify-phase17.sql). Do not rerun the destructive reset.
- **Review now:** [Realtime setup and two-browser checklist](docs/realtime.md). Hosted installation and actual WebSocket/browser verification remain pending.
- **Next phase after review:** Phase 18, complete multi-user/security/browser acceptance checks. Release remains Phase 19.

Stop at this Phase 17 checkpoint. The agent has not applied the hosted migration or changed hosted data/Auth/Realtime settings.
