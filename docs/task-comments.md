# Task comments

Phase 8 completes the comment flow introduced in the task-detail panel. It uses the installed `comments` table and existing guest session. No new SQL, dependencies, or environment variables are required.

## Implemented

- A separate comment list and composer keep discussion independent of task-field saves. Comments load only for an opened, owned task.
- Comments display oldest first using the full-precision timestamp and UUID tie-breaker. Each entry shows You, plain-text content with line breaks, and an exact localized `<time>` value.
- Reads request 51 rows to display a 50-comment page and determine whether more exist. Timestamp/ID cursors retain microsecond precision. Overlapping results merge by ID without duplicate entries.
- Initial loading, empty history, read errors, page loading, and page errors have distinct presentations. Retry loading more comments resumes the failed cursor; it does not restart at page one.
- Newly posted comments remain visible when an older history response arrives or history is reloaded. If unread history precedes a recent post, Load more appears in that gap. Reload starts history at the first page while retaining confirmed local posts.
- UI, store, and service validation reject blank comments and enforce the 2,000-character limit. Trimming removes surrounding whitespace while preserving internal line breaks. Comments render as text, including strings that resemble HTML.
- Posting blocks duplicate submissions. A confirmed server row is merged before clearing the unchanged draft. A newer draft remains intact if an earlier save finishes later.
- Failed saves keep the draft and offer Retry comment. Stable request IDs and owned read-back reconciliation recover uncertain results without assigning a new identity to the same retry.
- Comment drafts survive Comments/Activity switches and failed reads/saves. Existing close/navigation guards protect unsaved drafts and pending writes. Task/guest changes isolate later responses and drafts from the previous context.
- The author is the authenticated guest. Team profiles remain assignment metadata and cannot be selected as comment authors. Comments are append-only in this version; deleting the parent task removes them through the owned foreign key.

## Checkpoint review

Run `npm run dev` and open a task's Comments tab.

1. Post a multiline comment. Check the author, timestamp, preserved line breaks, cleared composer, and refresh persistence.
2. Try whitespace-only text and the 2,000-character boundary. The composer should reject invalid submissions and show its character count.
3. Type a draft, switch to Activity and back, then try Escape or browser Back. Cancel discard and confirm the draft remains.
4. Temporarily use the browser's offline network setting while posting. Confirm the draft stays and Retry comment works after restoring connectivity. Avoid repeatedly submitting while a request is pending.
5. On a task with over 50 comments, check Load more, chronological order, and page-error retry. Post while more history remains and confirm the pagination gap appears before the recent post.
6. Delete a disposable task with comments and confirm its panel closes and its discussion does not appear on another task.

Long-history, failed-read, delayed-response, and uncertain-save cases are covered by local fixtures; no bulk comments were inserted into the hosted project for these checks.

## Verification boundary

UI/store tests cover loading and read failures, safe text/timestamps, explicit post retry, validation boundaries, page retries, overlapping results, microsecond ordering, recent-post gaps, reload/read races, duplicate submission guards, newer drafts during pending saves, and guest/task isolation. Transport tests use the real Supabase query builder with mocked responses to verify task/owner filters, 50-row pagination, preserved cursors, normalized insert bodies, server timestamps, and uncertain-save reconciliation.

Read-only hosted checks confirmed RLS, the body constraint, the owner/task foreign key with `ON DELETE CASCADE`, the pagination index, authenticated read/insert access, and absence of guest timestamp-insert/update/delete privileges. Unauthenticated SELECT access is not granted. No hosted comment records were written during this checkpoint. Live browser persistence, touch/keyboard behavior, real task-deletion cascade execution, and two-guest API isolation remain manual/Phase 18 checks.

Local validation passes: `npm test -- --maxWorkers=2` (83 tests across 19 files), ESLint, and the TypeScript/production build. Comment components remain inside the lazy-loaded task-detail bundle.

Activity formatting, relative timestamps, and timeline recovery are documented in the [Phase 9 guide](task-activity.md). Remaining work is tracked in [path-updates.md](../path-updates.md).
