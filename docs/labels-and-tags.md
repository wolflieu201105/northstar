# Labels and task tagging

Phase 7 adds label management and task-card chips using the installed schema and existing atomic task RPC. No additional SQL, dependencies, or environment variables are required.

## Implemented

- The Labels page creates, renames, recolors, archives, and restores labels. Names contain 1–40 characters after trimming. The existing six-color palette includes a live preview with contrasting text.
- Active and Archived lists show whole-board task usage counts. Inline forms preserve failed drafts, prevent duplicate submissions, protect unsaved edits, and block navigation while a write is pending.
- Names are unique within a guest workspace, ignoring case, including archived labels. The form catches known duplicates; services also handle database uniqueness conflicts, including newer records absent from the cached list.
- Matching archived names offer Restore existing label. Restoration keeps that record's saved name, color, and task links. It does not create a duplicate or merge other labels. A failed conflict lookup offers Reload labels while retaining the draft.
- New tasks and task details allow zero or multiple labels. Search appears for longer lists and keeps selections that are temporarily hidden by the search. Complete selection arrays are saved atomically with task fields and assignees.
- Cards show two label chips and an expandable overflow count. Names render as plain text; full overflow contents can be opened with keyboard or touch. Archived chips retain an explicit marker.
- Renames, colors, and archival update current cards and pickers through canonical workspace metadata. Existing links survive archival and remain removable. Archived labels cannot be added to new tasks; restoration makes them selectable again.
- Existing server-generated activity keeps its recorded label-name snapshots. Browser code does not rewrite historical events.

Bug, Feature, and Design are input examples only. No shared labels or sample records are inserted.

## Checkpoint review

Run `npm run dev` and use Vite's Local URL.

1. Open Labels and create Bug, Feature, and Design with different colors. Try adding `bug` again; verify the duplicate message.
2. Create a task with several labels. Confirm two chips plus expandable overflow on the card. Open details, change the selection, save, and clear all labels once.
3. Rename/recolor a linked label. Confirm current cards and pickers update while earlier Activity entries keep their recorded names.
4. Archive a linked label. Confirm its existing chip stays marked Archived, it disappears from new choices, and its task count remains in the Archived view.
5. Start adding a name matching the archived label. Choose Restore existing label and confirm its saved color/name and task links remain. Check that another record was not created.
6. Refresh and verify persisted labels, links, and label activity. Check narrow-screen layout, keyboard controls, and preserving a failed save draft with network access temporarily disabled.

Board filtering by label remains in Phase 10, alongside assignee filtering and combined filter behavior.

## Verification boundary

Automated tests cover name/color validation, case-insensitive duplicates, same-record case-only renames, cached and server-discovered archived conflicts, restoration failures, stable create IDs, duplicate submission guards, pending navigation, card metadata propagation, literal punctuation in names, safe text rendering, searchable selection retention, archived removal, and atomic task payloads with zero/multiple labels. Transport tests exercise the real Supabase query builder with mocked responses and verify owner filters and request bodies.

Read-only hosted metadata checks confirmed the label name/color constraints, unique `(user_id, lower(name))` index, RLS on labels/task links, intended authenticated grants, and no unauthenticated SELECT access. These checks and local tests did not write hosted records. Live persistence/activity, responsive appearance, and actual browser keyboard/touch behavior remain manual review items. Two-guest API isolation checks remain in Phase 18.

Local validation passes: `npm test -- --maxWorkers=2` (68 tests across 17 files), `npm run lint`, and `npm run build`, including TypeScript. The Labels page is loaded as a separate bundle. The obsolete read-only directory component was replaced by this management view.
