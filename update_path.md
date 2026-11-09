# Current update path

The full numbered plan remains in [path-updates.md](path-updates.md).

- **Phases 12–13:** group SQL installed and verified by the user. [SQL guide](docs/shared-groups-migration.md).
- **Phase 14:** accounts, self profiles, same-identity guest registration, native email confirmation, sign-in/out, and password recovery implemented.
- **Phase 15:** groups, real members, invitation previews/acceptance, and ownership controls implemented.
- **Phase 16:** board/tasks/labels/comments/activity scoped to the selected group; draft/conflict protection and identity/group state isolation implemented.
- **Review now:** [Auth settings and the manual account/group checklist](docs/accounts-and-groups.md). No additional SQL is needed; do not rerun the destructive reset.
- **Next implementation:** Phase 17, authorized Realtime synchronization and reconnect/periodic access recovery.

The user authorized Phases 14–16 consecutively. Stop after Phase 16 for review. Local automated checks pass; actual email delivery, guest conversion/login across browsers, visual/touch behavior, and real JWT/API acceptance checks remain manual/Phase 18. Final release remains Phase 19.
