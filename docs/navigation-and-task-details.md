# Navigation and task details

Phase 5 adds a task-detail panel and workspace navigation. It uses the Phase 4 services and installed Phase 3 schema; there is no additional SQL or environment configuration.

This document records the Phase 5 checkpoint. [Phase 6](team-members.md) adds Team management and assignees during task creation. [Phase 7](labels-and-tags.md) adds label management, tagging during creation, and card chips.

[Phase 8](task-comments.md) completes comment pagination, retry actions, chronological gaps, and draft recovery.

## Available in this checkpoint

- Board, Team, and Labels share the same guest session, task store, and workspace lookups. The Team/Labels screens list existing records; their create/edit/archive forms remain in Phases 6–7.
- Search and priority are stored in the URL and preserved between views. Opening a task keeps the board mounted, including its horizontal scroll position.
- Task titles and the separate detail action open a panel. The dedicated drag handle retains its existing role.
- Metadata uses shared task fields and the exact saved timestamp for conflict detection. Saving keeps the panel open and updates canonical board state.
- Assignee and label checkboxes save their complete selections in the same transaction as task fields. Existing archived links can be removed; archived records cannot be newly selected.
- Comments and Activity have independent loading, retry, empty, and pagination states. Comments post through the existing stable-ID service. Activity descriptions come from stored server events, including historical member/label names.
- Unsaved metadata and comment drafts survive tab switches and failed saves. Close, navigation, and Back/Forward ask before discarding. Pending writes block navigation; refresh/closing the browser uses its native unload warning where supported.
- A stale edit retains the draft and requires explicitly loading the latest saved task before another save. This replaces metadata edits only; the comment draft stays.
- Deleting a task requires confirmation, clears its selection, and unmounts its discussion store.

## URLs

| URL | Surface |
| --- | --- |
| `/` | Board |
| `/?view=team` | Team directory |
| `/?view=labels` | Labels directory |
| `/?task=<task-id>` | Task panel over the board |
| `/?task=<task-id>&q=launch&priority=high` | Task panel with board filters retained |

Unknown views/priorities fall back to the board/all priorities. A management view takes precedence over a task parameter. Unknown/inaccessible task IDs display a generic unavailable message after owned tasks load. URL values never authorize access.

Deliberate navigation pushes history; typing and filter refinements replace the current entry. Closing a task removes its query parameter with replacement so a directly opened link stays inside the app. A rejected Back/Forward restores the previous history position and keeps the draft mounted.

## Accessibility and mobile

The detail panel uses one native modal dialog for browser focus containment and Escape handling. Its header and close control stay visible while content scrolls. Metadata and comments use sibling forms. Tabs support arrow keys, Home, and End. On close, focus returns to the connected opener or an active workspace heading. The desktop side panel fills the viewport on mobile, and navigation wraps into its own row.

## Checkpoint review

Run `npm run dev` and use the Local URL printed by Vite.

1. Set a search/priority filter, visit Team and Labels, and return to Board. Confirm the filters remain. Management forms are reserved for the next two checkpoints.
2. Open a task by its title. Edit and save it; confirm the panel stays open and the board reflects the save. Use the drag handle after closing to check that dragging still works.
3. Type an unsaved title and comment. Switch tabs, then press Escape or browser Back. Cancel the discard prompt and confirm both drafts remain.
4. Post a comment and inspect Activity after a metadata/status change. Refresh the task URL and confirm the persisted data returns. Existing tasks may have no history before the database upgrade.
5. Open `/?task=00000000-0000-0000-0000-000000000000`. Confirm the generic unavailable state and Return to board action.
6. Check narrow-screen layout, keyboard Tab/Escape, focus return, and a disposable task's delete flow.

Automated checks cover URL normalization, filter preservation, direct links, Back/Forward cancellation, exact edit tokens, multiple selections, archived removal, conflict recovery, pending writes, failed comment/save drafts, deletion confirmation, and focus cleanup. Native focus containment, touch dragging, responsive appearance, and live Supabase persistence still need browser review. Tests use mocked services or transport and make no hosted writes.

Validation: the full suite passed 40 tests across 9 files. A subsequent clean-task rollback fix passed all 7 detail-panel tests, including its new regression case. ESLint, TypeScript, and the production build pass on the final source. Detail and directory components remain separate lazy-loaded bundles.
