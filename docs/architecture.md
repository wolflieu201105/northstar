# Source and style organization

The maintenance checkpoint after Phase 8 reorganizes the existing application by feature. It changes file ownership and component boundaries while preserving behavior, SQL, dependencies, and the black–green styling.

## Source layout

| Location | Responsibility |
| --- | --- |
| `src/app/App.tsx` | Session/configuration gates and application composition. |
| `src/app/hooks/useWorkspaceController.ts` | Coordinates identity/group selection, group-scoped task/lookups, navigation guards, and dialog state. |
| `src/app/components/` | Header, shell, view switching, dialogs, and notices. |
| `src/app/state/` | Browser history and query-string navigation. |
| `src/features/board/` | Board page, columns, toolbar, summary, and loading/empty states. |
| `src/features/tasks/` | Task types, validation, services, stores, hooks, cards, forms, and details. |
| `src/features/team/` | Read-only real-account avatars and assignment controls. |
| `src/features/labels/` | Group label management, controls, services, and validation. |
| `src/features/account/`, `src/features/groups/` | Account/profile forms and group/member/invitation pages with small components, services, hooks, and stores. |
| `src/features/comments/`, `src/features/activity/` | Discussion UI, persistence, formatting, and validation for each feature. |
| `src/features/workspace/` | Shared member/label lookup state used across the workspace. |
| `src/features/auth/` | Native Auth subscriptions, callback handling, guest conversion, and recovery. |
| `src/shared/` | Reusable UI/hooks, generic state/data helpers, common contracts, and the Supabase client. |
| `src/test/` | Test environment setup and shared fixtures. |

Inside a feature, use `components/`, `pages/`, `hooks/`, `services/`, and `state/` when there is code for those responsibilities. Small domain files such as `types.ts`, `utils.ts`, and `validation.ts` stay at the feature root. Tests sit beside the implementation they exercise. Imports point directly to the owning module.

The app shell owns orchestration; feature components own their interface and behavior. Shared code has no imports from application or feature modules. Shared timeline/navigation contracts avoid tying generic helpers to a particular discussion or page.

The generated Supabase schema remains one file at `src/shared/types/database.ts`. Regenerate that file when the schema changes. Domain-specific row validation lives with its feature; basic record/text predicates are shared.

Phases 12–13 prepare the [group database and checked APIs](shared-groups-migration.md) without changing the hosted database or this private frontend. SQL sources are split under `supabase/sql/groups/`; `supabase/scripts/build-schema.ps1` compiles the complete SQL Editor artifacts. Generate the group client types and connect the frontend in Phases 14–16; current generated types and owner-only services are not group-aware.

## Smaller component boundaries

- `App.tsx` is now 23 lines; the original 221-line component is divided into a controller, shell, views, dialogs, and `BoardPage`.
- `TaskDetailPanel` owns the modal shell/loading state. `TaskDetailEditor` owns the draft, conflict handling, save/delete actions, and discussion placement. Their prop contracts are in `features/tasks/details/types.ts`.
- `TaskDiscussion` owns tab selection. Comment components and `ActivityTimeline` own their respective contents. Activity descriptions have a separate formatter with the existing output.
- Board skeleton/empty states live with the board. Configuration/session/error states remain shared.

Lazy loading remains on the board, task form, task-detail panel, Team page, and Labels page. The board stays mounted while management pages are shown, preserving filters and scrolling.

## Styles

`src/main.tsx` loads `src/styles/app.css` once. The maintenance checkpoint split the former 1,368-line stylesheet into an ordered import entry point and 30 smaller stylesheets, expanding dense single-line rules for editing. Later features add files in the relevant style folder; Phase 9 adds the separate activity stylesheet and Phase 10 adds board filter styles.

| Folder | Edit here for |
| --- | --- |
| `styles/base/` | Colors, spacing/radius tokens, fonts, reset, and base elements. |
| `styles/layout/` | Header, page layout, app states, and notifications. |
| `styles/shared/` | Buttons/controls, forms/dialogs, and relationship pickers. |
| `styles/board/` | Board overview, toolbar, columns, empty/loading states, and team strip. |
| `styles/tasks/` | Task cards, detail panel, discussion, and assignee presentation. |
| `styles/activity/` | Activity summaries, old/new details, metadata, and pagination. |
| `styles/team/`, `styles/labels/` | Avatars and label chips. |
| `styles/workspace/` | Workspace navigation, directories, and member/label editors. |
| `styles/responsive/` | Existing device-specific overrides and reduced-motion rules. |

These files retain the existing global class names. Keep the entry-point import order: foundations precede feature rules, and responsive overrides follow them. Add styles to the relevant file instead of appending component rules to the entry point.

The refactor compared the expanded CSS syntax trees before and after splitting. All 324 original top-level rules/at-rules have identical selectors, declaration values/order, importance flags, keyframes, and media-query ordering. Only file boundaries and formatting changed.

## Development and review

Edit files under `src/`. `npm run build` regenerates `dist/` with optimized, hashed assets; generated asset filenames change between builds.

Run the normal test/lint/build commands. On this Windows workspace, `npm test -- --maxWorkers=2` avoids the previously observed worker startup/file-access issue. The app-composition regression checks that management navigation preserves board filters/scroll and a detail save updates the same canonical card.

For browser review, run `npm run dev`, visit Board/Members/Labels/Groups/Invitations/Account, open and save a task, post a comment, and check narrow-screen dialogs. Native focus behavior, touch dragging, and appearance remain browser checks. The [activity guide](task-activity.md) documents formatting/clock modules; the [Phase 10 board guide](board-filters.md) covers combined filters, the shared local-date clock, and summary behavior.

Maintenance-checkpoint validation: 84 tests passed across 21 files, including the new app-composition regression. ESLint and the TypeScript/production build passed. The CSS syntax-tree comparison passed for all 324 original top-level rules/at-rules, and the production CSS retained its prior asset hash. That refactor made no hosted data or schema changes; later features extend these styles separately.
