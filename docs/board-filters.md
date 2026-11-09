# Board filters, dates, and summaries

Phase 10 adds combined relationship filters and finishes the existing due-date and summary behavior. This checkpoint uses existing task/member/label reads. It requires no additional SQL, packages, or environment values.

## Filter behavior

- Search trims whitespace and matches titles or descriptions without case sensitivity.
- Priority, search, assignees, and labels combine using AND.
- Selecting several members matches tasks assigned to any of them. Selecting several labels matches tasks with any of those labels.
- All removes a relationship restriction. Unassigned and Unlabeled match tasks without that relationship and replace selected IDs in that group.
- Archived members and labels remain selectable as filters while linked to a task. Their options and filter chips say Archived. Unused archived records stay out of the options.
- Each active filter has a removal chip. Clear filters resets all four groups.
- Unknown/deleted IDs are ignored after both tasks and the relevant lookup load successfully. Pending or failed reads retain the URL selection and offer loading/retry controls.

The board always retains its four columns when filters return no matches. Each filtered column displays visible and total counts, such as `2 of 6`. Filtering derives a view of canonical tasks without altering their assignments or labels.

## URLs and navigation

`q` stores search text; `priority` stores `low`, `normal`, or `high`.

Repeat `assignee=<member UUID>` or `label=<label UUID>` for multiple selections. Use `assignee=unassigned` or `label=unlabeled` for the exclusive empty modes. Repeated IDs are deduplicated; an empty mode takes precedence over IDs in its group. Omitting a group means All.

Filters survive task details, Team/Labels navigation, refresh, and Back/Forward. Filter changes replace the current history entry; opening another view/task creates an entry. Existing unsaved-draft guards continue to apply. A URL does not grant access to another guest's data.

## Dates and summary scope

Cards and the summary share one local-calendar clock. It refreshes at the next local midnight and catches up when the document becomes visible or the window regains focus. It schedules the next calendar midnight rather than assuming every day is 24 hours, and removes its timer/listeners on unmount.

Incomplete tasks show Overdue before today, Due today on today's date, and Due soon for the next one to three calendar days. Later dates and completed tasks show a neutral saved date; tasks without a date say No due date. A completed task never contributes to Overdue. Icons and readable urgency text accompany the colors, and saved dates use a `time` element.

The summary is visibly labeled Whole board. It counts canonical task records once, regardless of the number of linked members/labels. `Showing X of Y tasks` reports filtered results separately. Summary values show placeholders during loading or after a failed task read; Retry restores authoritative counts.

## Source ownership

- `features/board/filters/`: option selection, missing-ID handling, and filter contracts.
- `features/board/components/`: toolbar, relationship controls, chips, and summary.
- `features/board/hooks/`: filter lookup coordination and the local-date clock.
- `features/tasks/utils.ts`: combined matching, calendar urgency, and summary calculations.
- `app/state/navigationStore.ts`: repeated query parameters and history behavior.
- `styles/board/filters.css`: filter-specific styles; mobile rules remain in `styles/responsive/`.

## Checkpoint review

Run `npm run dev` and use existing tasks or create a few with different assignments, labels, priorities, and dates.

1. Select multiple assignees and labels, then add search and priority. Confirm ANY matching within each relationship group and AND matching between groups. Confirm Whole board totals remain unchanged as filters narrow the results.
2. Remove an individual chip, then Clear filters. Try Unassigned and Unlabeled. With no matches, check the message, all four columns, and visible/total counts.
3. Open/close task details, visit Team and Labels, use Back/Forward, and refresh. Confirm the selected filters remain. An archived option still linked to a task should remain filterable.
4. Set dates for yesterday, today, three days ahead, and four days ahead. Confirm urgency and counts. Mark an overdue task Done: its date should remain visible and neutral, and the overdue count should decrease.
5. On a narrow screen and with keyboard navigation, open both filter groups, search options, select several checkboxes, and remove chips. Confirm controls and long names stay reachable. After a tab has been backgrounded across midnight, return and check that urgency/counts catch up.

Automated validation on November 9, 2026: 135 tests across 30 files passed, plus ESLint and the TypeScript/production build. A focused 34-test run under `America/New_York` also passed, including spring/fall DST transitions, month/year/leap-day boundaries, midnight updates, cleanup, completed-task dates, navigation, missing IDs, and failed-load recovery.

Native keyboard/touch behavior, visual layout, and real tab suspension remain browser review items. Phase 11's real guest-client security checks remain pending; this checkpoint made no hosted writes.
