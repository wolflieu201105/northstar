# Task activity timeline

Phase 9 completes the Activity view using the history already recorded by the Phase 3 database triggers. No additional SQL, dependencies, or environment variables are required.

## Implemented

- Typed formatters display task creation, status transitions, field edits, assignment changes, and label changes. Creation includes the saved initial title/status; edits offer View changes with the recorded old/new values.
- Member and label names come from historical payload snapshots. Current profile/label renames do not rewrite earlier entries. The actor is the authenticated guest, displayed as You; a team profile cannot be selected as the actor.
- Unknown event types, unsupported payload versions, and unrecognized field values have safe fallback text. Stored HTML/JSON is not interpreted as markup or inserted into the page.
- Relative labels update every 30 seconds while Activity is visible and refresh after window focus/visibility changes. One clock serves the visible list and is cleaned up when the tab/panel closes. Each timestamp exposes an exact localized date/time including seconds, plus the original timestamp in its `datetime` attribute. Long relative intervals are approximate; the exact time remains available.
- Activity reads use 50-row pages, owner/task filters, and full-precision timestamp/UUID cursors. Rows merge without duplicates and remain oldest first. Load more reaches later history; the newest changes are at the end.
- Initial loading, refresh, empty baseline, read failure, and page failure are distinct. A failed page retries its same cursor. Refresh activity restarts from the first page. Existing rows remain available if a request fails.
- Committed task revisions refetch server history after fields, status, assignments, or labels change. Optimistic moves and rejected/no-op saves do not generate browser-authored events. A late response from an older page cannot overwrite a newer refresh.
- The empty state explains that changes made before history was enabled are unavailable. Earlier history is not reconstructed.

## Source locations

- `src/features/activity/components/`: timeline and relative timestamp UI.
- `src/features/activity/formatting/`: typed event/field formatting and relative-time labels.
- `src/features/activity/hooks/`: the clock lifecycle.
- `src/features/activity/services/activity.ts`: read-only paginated queries.
- `src/features/tasks/state/detailStore.ts`: task-specific activity loading, retry, ordering, and invalidation.
- `src/styles/activity/timeline.css`: timeline presentation using the existing black–green tokens.

## Checkpoint review

Run `npm run dev` and open a task's Activity tab.

1. Change the title, description, priority, and due date, then save. Check the event summary and expand View changes for old/new values.
2. Close the panel, move the task to another column, and reopen Activity. Check the recorded status transition.
3. Add/remove assignees and labels. Rename a related profile/label afterward and confirm earlier activity retains the recorded name.
4. Keep Activity open across a minute boundary, then switch tabs or close/reopen the panel. Check relative labels and the exact timestamp tooltip/accessibility text.
5. With a longer history, load another page. Temporarily disable networking, verify that existing events stay visible, and retry after restoring connectivity. Refresh starts again at the oldest page.
6. Refresh the task URL and check persistence. Use a disposable task for deletion checks.

Long-history, delayed-response, failure, and unknown-payload cases use local fixtures; no hosted activity records were fabricated for this checkpoint.

## Verification boundary

Local UI/store tests cover event snapshots and old/new fields, unknown contracts, safe text, relative-time boundaries, timer cleanup, exact accessible timestamps, pagination/retry, stale reads, and synchronization after committed changes. An optimistic rollback, rejected edit, and no-op result leave the displayed history unchanged. Transport tests exercise the real Supabase query builder with mocked responses and verify read-only owner/task scopes, cursor precision, ordering, and page size.

The existing native PostgreSQL suite was rerun on the dedicated local test cluster. Both fresh installation and upgrade passed 45 schema checks and 61 access/mutation checks, with catalog parity and repeat-application preservation. These checks include no-op event suppression, full rollback after a synthetic history-write failure, historical name snapshots, forbidden history writes, task deletion, and auth-user cleanup without orphaned records. Disposable databases were removed and the owned test cluster was stopped.

Read-only hosted metadata checks confirmed RLS, owner/actor constraints, authenticated SELECT with no activity write privileges, no unauthenticated read access, enabled capture triggers, and a private capture helper that API roles cannot execute directly. Agent verification did not write hosted rows or change the hosted schema. Real Supabase JWT/Data API isolation remains in Phase 18; remaining browser checks are distinguished below.

Local app validation passes: `npm test -- --maxWorkers=2` (112 tests across 26 files), ESLint, and the TypeScript/production build. Activity code and styles remain in their feature folders; the timeline is loaded inside the task-detail bundle.

## User-reported browser results

On November 9, 2026, the user confirmed:

- Assignment additions/removals save, survive refresh, and show the correct recorded names.
- Status changes and field edits appear correctly in Activity and View changes.
- Saving while offline preserves the draft and adds no success event.

Clock/mobile behavior, longer-history pagination/retry, and live cleanup have not yet been reported as browser-verified. Their automated/local SQL checks pass; real cross-guest JWT/API isolation remains separate.
