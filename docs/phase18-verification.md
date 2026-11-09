# Phase 18 verification checkpoint

Phase 18 is in progress. The user confirmed Phase 17 live updates working and subsequently confirmed the Phase 18 SQL verifier is correct. Local regression checks and real guest Data API/Realtime checks pass; the last hosted run explicitly skipped the stale-revision check, which still needs a full native HTTP rerun after the user-applied fix. Registered-user, email, mobile, and complete browser acceptance remain open. At the user's request, Phase 19 hosting preparation has started; see the [Vercel deployment guide](vercel-deployment.md).

## SQL to apply now

Your existing database already has Phases 12, 13, and 17.

1. In Supabase SQL Editor, run the entire [20261109151951_return_revision_conflicts_as_http_409.sql](../supabase/migrations/20261109151951_return_revision_conflicts_as_http_409.sql).
2. Run the read-only [verify-phase18.sql](../supabase/verify-phase18.sql). Expect three rows, with every boolean `true`.
3. Reload the app with the updated frontend. In two browsers, edit the same task, save in A, then save B's older draft. B should promptly show the conflict and retain its draft for review. Repeat with an older label draft and stale task deletion.

This additive migration changes three public function wrappers. It preserves arguments, grants, membership checks, revision comparison, and transaction rollback. It writes no application rows. The clean `schema.sql` and destructive `reset.sql` include the fix for future installations; **do not run either over the current database**. Applied Phase 12/13/17 migrations remain unchanged.

The real HTTP test found that a deliberately stale task save timed out instead of returning its conflict. The previous implementation raised SQLSTATE `40001`. This matches [Supabase's documented PostgREST retry-loop issue](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b): a business revision mismatch must use a nonretryable error. The public invoker wrappers now catch the internal serialization signal and raise `PT409`, which [PostgREST maps to HTTP 409](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes).

The frontend recognizes both old `40001` responses and new `PT409` responses through its existing conflict handling. It preserves drafts, reads the latest task, and requires review before retrying. The user now reports the hosted migration/verifier are correct; the agent has not rerun the complete HTTP conflict check since that confirmation. Prompt HTTP conflict delivery remains an acceptance gate. Temporary test groups were deleted, ending access to their tasks; no project restart or unrelated backend termination was performed.

## Checks completed on November 9, 2026

| Environment | Result |
| --- | --- |
| Frontend | 187 tests across 35 files passed; ESLint, TypeScript, and production build passed. |
| Native PostgreSQL 17 | Fresh and populated-reset paths each passed 76 access/mutation, 32 Realtime, and 7 new conflict-wrapper checks. The reset path also passed 39 foundation checks and three actual two-connection races. |
| SQL lifecycle | Phase 18 reapplication twice, full reset after shared operations, and fresh/reset catalog parity passed. Temporary databases were removed and the dedicated local cluster stopped. |
| Hosted `task-board` | 179 real guest/API/Realtime assertions passed with one explicit stale-conflict HTTP check skipped. These are native Auth sessions, not SQL Editor impersonation. |
| Types | Types regenerated from the hosted project exactly matched `src/shared/types/database.ts`. Phase 18 changes no public argument/result types. |
| Cleanup | All temporary Auth accounts, automatically created personal groups, and test groups were removed. Read-only checks found zero remaining run-marked accounts, profiles without Auth accounts, or assignments without active memberships. |

Tested source: working changes based on commit `9126c8a76151d84557d93e2b1a387367be615ed0`. Environment: Windows, Node 24.13.0, PostgreSQL 17; hosted project `eucugwxayfkqhhiesppm`. Hosted migration baseline: Phases 12/13/17; local target additionally includes `20261109151951`. No passwords or session tokens are stored in reports or fixtures.

The frontend fixes cover an unread-history gap hidden by a newly confirmed local comment, first-page refreshes losing their pagination cursor, late save errors invoking an old account's reconciliation/access callback, and duplicate joined assignee/label rows. A nondeterministic foundation fixture now uses one statement timestamp for its membership interval.

Guest acceptance covers shared edits, real profile joins, pending/private/removed-member isolation, cross-group parents even when the caller belongs to both groups, actor/timestamp forgery, zero-row profile updates with authorized readback, no-op/failed-save history, comment idempotency, append-only history/comments, archived labels, ownership transfer, invitation terminal retries, membership cleanup, and task-child cascades. Actual WebSocket joins succeeded for a member and the current account, rejected pending/removed members and another account's topic, and delivered committed content-free invalidations.

The native `realtime.send` implementation adds its own message UUID to the empty application payload. The local queue fixture and HTTP/WebSocket assertions now permit that transport ID while rejecting application content. No task, comment, profile, or relationship snapshot is broadcast.

## Advisor and dependency review

The hosted security advisor reported intentional authenticated-guest policy warnings and an informational RLS-without-policy notice for `private.api_rate_limits`. Guests intentionally share the authenticated role; membership predicates still restrict every group. The private quota table revokes all API grants and intentionally has no client policy. The hosted performance advisor reported 11 unused-index informational findings; the indexes support foreign keys and invitation/history access and are retained.

Leaked-password protection is disabled in the hosted project. This is now relevant to email/password accounts and remains an unresolved Auth setting for the project owner to review using [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), including plan availability. The agent did not change Auth settings or upgrade the plan.

The production-only npm audit reported **zero vulnerabilities**. The full audit reported ten moderate dependency entries from one development-only root advisory: [minimatch glob-pattern amplification](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). Installed version 10.2.6 is used by ESLint/typescript-eslint, not the shipped browser app. Version 11.0.1 fixes it but removes APIs such as `makeRe`; forcing that major beneath existing tooling is not a compatible patch ([upstream changelog](https://github.com/isaacs/minimatch/blob/main/changelog.md)). This is a recorded temporary development-tooling exception: repository-controlled patterns are used here; update when the upstream toolchain supports the fix. No forced dependency downgrade or major override was applied.

## Reproduce real guest checks

After applying Phase 18 SQL, use the public project URL/key already in `.env.local`:

```powershell
npm run test:api -- --project eucugwxayfkqhhiesppm
```

This is a separate, opt-in network test, not part of `npm test`. It creates four temporary native guest accounts, their automatically initialized personal groups, and shared/private test groups. It targets only records belonging to those new fixtures and checks the explicit project argument against the URL. Auth rate limits and CAPTCHA configuration still apply; the runner does not change those settings.

The runner removes fixture groups in `finally`, closes channels, and signs out its own sessions. It prints an ignored `.tmp/phase18-<run-id>.cleanup.sql` file. Run that exact file in SQL Editor to remove its four guest accounts; it checks account IDs, anonymous status, run metadata, and the absence of owned groups. The ignored manifest contains only fixture IDs/statuses, never tokens. If interrupted, use that manifest to review and finish the scoped cleanup. No privileged browser key is required.

The diagnostic `--skip-conflicts` option explicitly prints **PARTIAL** and does not satisfy the HTTP conflict gate. It was used only to finish unrelated checks against the unchanged hosted baseline after reproducing the retry issue.

## Remaining acceptance before Phase 19

- The user confirmed the additive migration/verifier are correct. Rerun the guest runner without `--skip-conflicts` to finish native HTTP acceptance.
- Repeat the API boundaries with registered-user tokens in a disposable project. The automated hosted run used guest tokens only.
- Verify native confirmation/recovery, expiry/resume, and guest registration preserving the exact UUID and all work when signing in elsewhere. The user reported account setup working; the agent has not independently exercised real email delivery.
- Review keyboard/touch and narrow-screen appearance, dirty concurrent edits, offline/reconnect, invitation changes, and removal with an open dirty detail in two actual browsers ([Realtime checklist](realtime.md#review-with-two-independent-browsers)). Component tests and Node WebSockets do not establish browser appearance or timing.
- Apply a clean schema to an empty disposable hosted project and repeat native-client acceptance. Local fresh/reset parity is complete; the existing user project was not reset.
- Resolve or explicitly accept the remaining password-protection setting and development-tooling advisory before release.
