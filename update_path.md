# Current update path

The full numbered plan remains in [path-updates.md](path-updates.md).

- **Phases 12–13:** group SQL verified by the user.
- **Phases 14–16:** accounts, guest registration, groups/invitations, and scoped task work implemented. The user reported the account setup working.
- **Phase 17:** installed and user-confirmed working. Phase 18 also verified actual authorized/denied WebSocket joins and committed delivery.
- **Phase 18:** in progress. 187 frontend tests and local fresh/reset/concurrency checks pass; 179 real guest/API/Realtime assertions passed with the stale-conflict HTTP check explicitly skipped.
- **SQL now:** apply [the additive HTTP-conflict fix](supabase/migrations/20261109151951_return_revision_conflicts_as_http_409.sql), then [verify-phase18.sql](supabase/verify-phase18.sql). The real API test found stale revisions could hang in PostgREST's `40001` retry loop. Do not reset the database.
- **Review now:** [Phase 18 results, SQL instructions, and remaining checks](docs/phase18-verification.md). After SQL verification, rerun native conflicts and finish registered-user/browser acceptance.
- **Next phase after acceptance:** Phase 19, documentation and release.

Stop at this Phase 18 SQL checkpoint. The new migration has not been applied to the hosted database. The user authorized temporary test fixtures in `task-board`; all were removed. Existing user work and hosted Auth/Realtime settings were preserved.
