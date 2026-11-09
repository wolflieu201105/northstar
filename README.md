# Northstar Task Board

Northstar is a responsive Kanban task manager built for frictionless guest use. A visitor is signed in anonymously through Supabase, receives a private workspace, and can create and move persistent tasks without completing a registration form.

The interface uses a restrained black-and-green visual system and supports desktop and narrow-screen workflows.

## Project status

- Private-workspace frontend: implemented and tested locally
- Shared groups: database, permissions, and atomic APIs tested locally; account/group frontend integration pending
- Live demo: pending deployment
- Source repository: pending publication

## Features

These describe the current private frontend. The shared-group backend is ready for SQL setup; its account and group screens follow in Phases 14–16.

- Automatic anonymous guest sessions that persist in the browser
- Private task storage protected by Supabase Row Level Security
- Four workflow columns: To Do, In Progress, In Review, and Done
- Create, edit, and delete task flows
- Board, Team, and Labels navigation with shareable task URLs and preserved filters
- Responsive task-detail panel with save-in-place editing and unsaved-draft protection
- Select existing assignees/labels, post timestamped comments, and inspect persisted activity
- Create, edit, archive, and restore team profiles with optional avatar colors
- Assign multiple members during task creation/editing and display member avatars on cards
- Create, rename, recolor, archive, and restore custom labels with duplicate-name recovery
- Attach multiple labels during task creation/editing and expand label chips on cards
- Chronological comment pagination, explicit save/page retry, and protected comment drafts
- Read-only activity history with before/after details, updating relative times, and paginated recovery
- Drag-and-drop status changes with optimistic updates and rollback on failure
- Keyboard/mobile status selector as an alternative to dragging
- Descriptions, priority levels, and calendar due dates
- Overdue, due-today, and upcoming indicators that refresh at local midnight and on page resume
- Neutral saved due dates for completed tasks
- Combined search, priority, multiple-assignee, and multiple-label filters with removable chips
- Unassigned/Unlabeled modes and archived options still linked to tasks
- Whole-board total, completed, and overdue summaries alongside filtered result counts
- Loading, empty, configuration, error, retry, and save states
- Responsive horizontal board navigation on narrow screens
- Accessible labels, focus states, dialog behavior, and reduced-motion support
- Lazy-loaded board and task form bundles

The roadmap is in [path-updates.md](path-updates.md), also linked from [update_path.md](update_path.md). Phases 12–13 now provide the [complete group SQL setup](docs/shared-groups-migration.md) and [permission/API contract](docs/group-security.md). The approved reset discards old board data and keeps actual Auth accounts. Phase 14 adds login/registration next, followed by group/frontend integration. Final verification and release remain Phases 18–19.

**Database transition:** The SQL can be installed now, but the old board will not work against the new backend until its group-aware integration. For the current project, run [reset.sql](supabase/reset.sql), then the read-only [verify-phase13.sql](supabase/verify-phase13.sql). No hosted reset has been performed by the agent.

## Technology

- React 19 and TypeScript
- Vite
- Supabase Auth, Postgres, and Row Level Security
- dnd kit React
- Lucide icons
- Vitest and Testing Library
- ESLint

## Security model

The new backend gives registered users and authenticated guests the same group permissions. Current database membership determines access; creator IDs, usernames, and user metadata do not. RLS scopes reads, self-profile edits allow only username/name/color, and all other client writes go through checked atomic APIs. Pending invitations expose a minimal preview without board access.

Group-owned tasks, comments, and history survive a non-owner account deletion with saved author names. Owner accounts must transfer or delete their groups first. Activity is generated from committed changes; clients cannot insert or rewrite it. See [the security contract and verification boundaries](docs/group-security.md).

The browser uses only a publishable Supabase key. Never place a secret key, service-role key, database password, or access token in a `VITE_*` variable.

## Prerequisites

- Node.js 22.12 or newer; Node.js 24 is used by CI
- npm 11
- A Supabase project

## Supabase setup

1. Create or open a Supabase project.
2. In Authentication settings, enable anonymous sign-ins.
3. Open the SQL Editor.
4. Follow the [group setup guide](docs/shared-groups-migration.md): use [`supabase/schema.sql`](supabase/schema.sql) for an empty project or [`supabase/reset.sql`](supabase/reset.sql) to discard the old application database. The current frontend needs the later integration before it can use this backend.
5. Copy the project URL and a browser-safe publishable key.

The complete SQL includes group integrity, Auth profile initialization, RLS/grants, protected history, invitation/group operations, and atomic task APIs. Run [verify-phase13.sql](supabase/verify-phase13.sql) afterward. Historical private-workspace setup is superseded.

## Local setup

Install dependencies:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set the following values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Legacy projects may use `VITE_SUPABASE_ANON_KEY` instead of the publishable-key variable, but a current publishable key is preferred.

Start the development server:

```bash
npm run dev
```

Vite normally serves the app at `http://localhost:5173`.

## Verification commands

```bash
npm run lint
npm test
npm run build
npm run preview
```

The automated suite covers due-date rules, filtering, summaries, task-input normalization, form validation, task mutations, optimistic movement, and rollback behavior.

## Manual security verification

Use two independent browser profiles so Supabase creates Guest A and Guest B.

1. Create a different task as each guest.
2. Confirm neither guest sees the other's task.
3. Refresh both profiles and confirm each task persists.
4. Move tasks between columns and confirm their statuses persist.
5. Clear one profile's browser data and confirm it receives a new workspace.

Clearing browser storage, signing out, or moving to another device loses access to an anonymous identity. Account recovery would require linking a permanent identity, which is outside this version's scope.

## Deploying to Vercel

The repository works with Vercel's Vite framework detection and requires no custom deployment configuration.

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Confirm the build command is `npm run build` and the output directory is `dist`.
4. Add both public variables in Project Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Apply them to Production and Preview as appropriate.
6. Deploy, then test create, move, refresh, and guest isolation on the deployed URL.

`VITE_*` variables are compiled into the browser bundle and are therefore public configuration. Vercel treats public-prefixed variables as Config values; do not use them for privileged credentials. Environment-variable changes require a new deployment.

The included [GitHub Actions workflow](.github/workflows/ci.yml) runs `npm ci`, linting, tests, and the production build. With Vercel's Git integration, use the workflow as a required check while Vercel handles preview and production deployments.

## Project structure

```text
src/
  app/              Application shell, navigation, and workspace coordination
  features/
    auth/           Guest-session startup
    board/          Board layout, filters, summary, and loading/empty states
    tasks/          Task forms, cards, details, hooks, services, and stores
    team/           Member management, avatars, and assignee controls
    labels/         Label management, chips, and tagging controls
    comments/       Comment list, composer, and persistence
    activity/       Activity rendering, formatting, and validation
    workspace/      Shared member/label lookup state
  shared/           Reusable controls, hooks, data helpers, and generated DB types
  styles/           Ordered CSS modules for foundations, features, and responsiveness
  test/             Shared test setup and fixtures
supabase/
  schema.sql        Schema, grants, triggers, and RLS policies
```

Edit source files under `src/`. `npm run build` regenerates `dist/` with hashed bundles. Tests live alongside the code they exercise. See [the architecture guide](docs/architecture.md) for file locations and CSS import rules.

## Design decisions

- Guest-first authentication removes signup friction while retaining per-user ownership.
- RLS is the security boundary; client-side filtering is only a usability aid.
- Status changes save immediately after a drop and roll back if persistence fails.
- Manual ordering within a column is intentionally excluded; tasks use stable creation-time ordering.
- Search and summary values are derived from loaded state, so filtering never mutates hidden tasks.
- Due dates are parsed as local calendar dates to avoid timezone-related day shifts.

## Known limitations

- Anonymous accounts cannot be recovered after their browser session is lost.
- The current version has one board per guest and no shared collaboration model.
- Dragging changes task status but does not persist arbitrary ordering within a column.
- Cross-tab realtime synchronization is not included.

## Future improvements

- Link guest workspaces to permanent accounts
- Add projects, invitations, and collaborative access policies
- Add labels, assignees, comments, and activity history
- Add persistent within-column ordering
- Add end-to-end browser tests against a disposable Supabase project
