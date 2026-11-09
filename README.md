# Northstar Task Board

Northstar is a responsive Kanban task manager for shared groups. Visitors can start as guests, register that same identity with email/password, and invite other real accounts to collaborate. Each account starts with an empty private group and can join or create more groups.

The interface uses a restrained black-and-green visual system and supports desktop and narrow-screen workflows.

## Project status

- Accounts, groups, invitations, and group-scoped board: implemented through Phase 16; local tests/lint/build pass
- Group SQL: user-reported verification passed; no new SQL needed for Phases 14–16
- Native email delivery and real two-browser flows: manual verification pending
- Realtime synchronization: Phase 17, not started
- Live demo: pending deployment
- Source repository: pending publication

## Features

The current frontend uses the shared-group schema and checked APIs. See [Auth setup and the review checkpoint](docs/accounts-and-groups.md) before testing registration/recovery.

- Automatic anonymous guest sessions that persist in the browser
- Group task storage protected by accepted membership and Supabase Row Level Security
- Email/password login, same-identity guest registration, resumable native confirmation, recovery, and explicit sign-out
- Globally unique usernames, copyable account IDs, editable self profiles, and real assignee identities
- Group creation/switching, invitation previews and inboxes, recipient acceptance, leave/removal/ownership transfer/deletion
- Four workflow columns: To Do, In Progress, In Review, and Done
- Create, edit, and delete task flows
- Board, Members, Labels, Groups, Invitations, and Account navigation with group/task URLs and per-group filters
- Responsive task-detail panel with save-in-place editing and unsaved-draft protection
- Select existing assignees/labels, post timestamped comments, and inspect persisted activity
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
- Unassigned/Unlabeled modes and archived labels still linked to tasks
- Whole-board total, completed, and overdue summaries alongside filtered result counts
- Loading, empty, configuration, error, retry, and save states
- Responsive horizontal board navigation on narrow screens
- Accessible labels, focus states, dialog behavior, and reduced-motion support
- Lazy-loaded board and task form bundles

The roadmap is in [path-updates.md](path-updates.md), also linked from [update_path.md](update_path.md). Phases 14–16 implement accounts, groups, invitations, and scoped task work on the [Phase 13 API contract](docs/group-security.md). Phase 17 adds Realtime; final verification and release remain Phases 18–19.

**Existing verified database:** No further SQL is needed for this frontend batch. Do not rerun the destructive reset. New installations can follow the [SQL setup guide](docs/shared-groups-migration.md); existing verified installations only need the [Auth configuration](docs/accounts-and-groups.md#supabase-auth-setup).

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
4. Follow the [group setup guide](docs/shared-groups-migration.md): use [`supabase/schema.sql`](supabase/schema.sql) for an empty project or [`supabase/reset.sql`](supabase/reset.sql) to discard the old application database. The current frontend targets this group backend.
5. Configure Email/Password, manual linking, and allowed callback URLs using the [Auth guide](docs/accounts-and-groups.md#supabase-auth-setup).
6. Copy the project URL and a browser-safe publishable key.

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

The automated suite covers native Auth/callback behavior with mocks, group/invitation HTTP contracts, identity/group state isolation, access-loss and draft guards, task/comments/activity/label behavior, filters, dates, summaries, and rollback. Real email delivery, browser appearance, and real JWT isolation remain separate manual checks.

## Manual security verification

Use two independent browser profiles so Supabase creates Guest A and Guest B.

1. Check private-group isolation, then invite B to a shared group from A's Members page.
2. Confirm B has no board access until B accepts in Invitations.
3. Create/edit/assign/comment as both accounts; use explicit refresh between browsers.
4. Register A's guest, complete native email/password setup, and confirm its UUID/work/memberships remain.
5. Test account/group switching, drafts, recovery, ownership transfer, and removal while a detail is open.

Follow the [complete manual review checklist](docs/accounts-and-groups.md#manual-review-checkpoint).

Register an anonymous guest before signing out or clearing browser storage to retain access from another browser. Signing into an existing account deliberately switches identity and does not merge guest work.

## Deploying to Vercel

The repository works with Vercel's Vite framework detection and requires no custom deployment configuration.

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Confirm the build command is `npm run build` and the output directory is `dist`.
4. Add both public variables in Project Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Apply them to Production and Preview as appropriate.
6. Add the deployed Auth callback URLs, then test login, registration, recovery, accepted membership, task persistence, and isolation on that URL.

`VITE_*` variables are compiled into the browser bundle and are therefore public configuration. Vercel treats public-prefixed variables as Config values; do not use them for privileged credentials. Environment-variable changes require a new deployment.

The included [GitHub Actions workflow](.github/workflows/ci.yml) runs `npm ci`, linting, tests, and the production build. With Vercel's Git integration, use the workflow as a required check while Vercel handles preview and production deployments.

## Project structure

```text
src/
  app/              Application shell, navigation, and workspace coordination
  features/
    auth/           Native sessions, PKCE callbacks, guest conversion, and recovery
    account/        Profile and account forms/services
    groups/         Groups, memberships, invitations, ownership, and scoped state
    board/          Board layout, filters, summary, and loading/empty states
    tasks/          Task forms, cards, details, hooks, services, and stores
    team/           Real-account avatars and assignee controls
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

- Guest entry removes signup friction; native registration preserves its UUID and group work.
- RLS is the security boundary; client-side filtering is only a usability aid.
- Status changes save immediately after a drop and roll back if persistence fails.
- Manual ordering within a column is intentionally excluded; tasks use stable creation-time ordering.
- Search and summary values are derived from loaded state, so filtering never mutates hidden tasks.
- Due dates are parsed as local calendar dates to avoid timezone-related day shifts.

## Known limitations

- Anonymous accounts cannot be recovered after their browser session is lost.
- Dragging changes task status but does not persist arbitrary ordering within a column.
- Shared updates require explicit refresh or focus revalidation; Realtime synchronization is the next phase.

## Future improvements

- Add authorized Realtime subscriptions and reconnect/periodic access recovery
- Complete real-browser and real-JWT multi-user acceptance checks
- Add persistent within-column ordering
- Add end-to-end browser tests against a disposable Supabase project
