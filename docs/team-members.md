# Team members and assignees

Phase 6 adds member management and board avatars on top of the existing schema and typed data layer. No new SQL, dependencies, or environment variables are required.

## Implemented

- The Team page creates and edits profiles with a name of 1–80 characters and an optional palette color. Inputs are trimmed and validated before writes; the installed database enforces its own name/color constraints.
- Active and Archived views show initials, names, status, and whole-board assignment counts. Inline forms retain drafts after failed writes, prevent duplicate submissions, and protect unsaved changes during navigation.
- Archive retains existing task assignments and historical activity. Restore makes the profile available for new assignments. Both operations are reversible; there is no member deletion action.
- A board team strip displays active profiles with overflow and a Manage team action. Cards display up to three assignee avatars plus overflow, accessible names for every assignee, and an archived marker when applicable.
- New tasks and task details support zero, one, or multiple assignees. Large pickers provide a name search while preserving selections hidden by that search. Unassigned is the explicit zero-selection state.
- Assignment changes use the existing atomic task RPC. Archived links already on a task remain removable; archived profiles are excluded from new choices.
- Canonical workspace metadata supplies names, colors, and archive state to existing cards and pickers after a committed member change. Stored activity continues to use historical snapshots.
- Team profiles describe task assignments in the current guest workspace. Adding a profile does not create an account, invite a person, or share access.

## Checkpoint review

Run `npm run dev` and use Vite's Local URL.

1. Open Team and add two profiles, choosing an optional color for one. Check the board's team strip.
2. Create a task with both assignees. Open its details, change the selection, save, and check the card avatars and assignment activity. Clear all selections to verify Unassigned.
3. Rename/recolor a linked member. Confirm current avatars/pickers update while earlier activity keeps its recorded name.
4. Archive a linked member. Confirm it disappears from the active team strip and new choices, remains visible on existing tasks with an archived marker, and retains its assignment count in the Archived view.
5. Restore the member and assign it to another task. Refresh and check that member changes, assignments, and history persist.
6. Check narrow-screen controls and keyboard access. With network access temporarily disabled, try a member save and confirm the input remains available for retry.

## Verification boundary

Automated UI/store tests cover create retry identity, duplicate submissions, profile editing, archive/restore, assignment retention, canonical card updates, pending navigation guards, invalid names, searchable selections, task creation with zero/multiple assignees, and accessible overflow names. Transport tests use the real Supabase query builder with mocked responses to verify owner filters and request bodies.

Read-only hosted metadata checks confirmed the member name/color constraints, RLS on member/assignment tables, intended authenticated grants, and absence of unauthenticated SELECT access. No hosted records were written during this checkpoint. Live persistence, assignment activity, responsive appearance, and actual keyboard/touch interactions remain manual checks; the two-guest API isolation checks remain in Phase 11.

Local validation passes: 52 tests across 13 files, ESLint, TypeScript, and the production build. The Team management page is loaded as a separate bundle.

The existing member service follows Supabase's [filtered update and returned-row pattern](https://supabase.com/docs/reference/javascript/update). Label management remains the next checkpoint in [path-updates.md](../path-updates.md).
