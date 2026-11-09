# Current update path

The full numbered plan remains in [path-updates.md](path-updates.md).

- **Phases 12–13:** group SQL verified by the user.
- **Phases 14–16:** accounts, guest registration, groups/invitations, and scoped task work implemented. The user reported the account setup working.
- **Phase 17:** installed and user-confirmed working. Phase 18 also verified actual authorized/denied WebSocket joins and committed delivery.
- **Phase 18:** in progress. 187 frontend tests and local fresh/reset/concurrency checks pass; 179 real guest/API/Realtime assertions passed with the stale-conflict HTTP check explicitly skipped.
- **SQL:** the user confirmed the Phase 18 migration/verifier are correct. No additional SQL or reset is needed for Vercel hosting. The full native HTTP-conflict rerun remains open.
- **Review now:** [Vercel deployment guide](docs/vercel-deployment.md). Deployment configuration and a successful production build are ready; hosted deployment and production Auth URLs remain to be completed.
- **Phase 19:** hosting preparation started at the user's request. Remaining Phase 18 checks are still recorded in [the verification report](docs/phase18-verification.md).

Stop at the deployment checkpoint after the first hosted build and its Auth URL setup. The Vercel app connection currently needs account/team authorization; dashboard import is also documented. No deployment has been created by the agent. Temporary Phase 18 fixtures were removed; existing work and Auth/Realtime settings were preserved.
