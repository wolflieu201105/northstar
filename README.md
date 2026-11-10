# Northstar Task Board

A shared-group Kanban task manager built with React, TypeScript, Vite, and Supabase, using a black-and-green interface.

- [Live app](https://northstar-six-zeta.vercel.app/)
- [GitHub repository](https://github.com/wolflieu201105/northstar)
- [Assessment PDF](deliverables/GiaHuy_Pham_task_manager_assessment.pdf)

## Features

- Guest entry, email/password accounts, guest registration, and password recovery.
- Unique usernames, real account profiles, multiple groups, and invitation acceptance.
- Four task statuses: To Do, In Progress, In Review, and Done.
- Task creation/editing/deletion, drag-and-drop moves, priorities, and due dates.
- Multiple assignees with initials/color avatars, custom labels, and label archival.
- Task comments and database-generated activity with before/after changes.
- Combined search, priority, assignee, and label filters; group-wide task statistics.
- Private live updates, reconnect recovery, retained drafts, and explicit stale-save conflicts.
- Responsive layouts, keyboard status controls, and group/task links.

## Local setup

Use Node.js 24 (see `.nvmrc`), npm 11, and a Supabase project.

```bash
git clone https://github.com/wolflieu201105/northstar.git
cd northstar
npm ci
cp .env.example .env.local
```

On PowerShell, use `Copy-Item .env.example .env.local` for the last command. Set your own project values:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

In Supabase:

1. Enable anonymous sign-ins, Email/Password, and **Allow manual linking** in Authentication settings.
2. For a **new, empty application schema**, run the complete [supabase/schema.sql](supabase/schema.sql) in SQL Editor. It contains all tables, constraints, indexes, grants, RLS policies, functions, and triggers. The existing live project is already installed; do not rerun it there.
3. In Realtime settings, disable **Allow public access**. The app uses private Broadcast channels; application tables do not need Postgres Changes publication.
4. Add `http://localhost:5173/**` to Authentication's allowed Redirect URLs. A new local-only project can use `http://localhost:5173/` as its Site URL; retain the production Site URL when sharing the deployed project's database.
5. Keep Supabase's native confirmation rules as configured. Guest registration links email to the existing guest and sets a password after verification. Check native email delivery/SMTP settings if confirmation or recovery links do not arrive.

```bash
npm run dev
```

Open `http://localhost:5173` (or the port Vite reports). Only browser-safe project values belong in `VITE_*` variables; they are compiled into public JavaScript. Keep `.env.local` and privileged credentials out of Git.

## Checks

```bash
npm run lint
npm test -- --maxWorkers=2
npm run build
npm run preview
```

Tests live alongside their source. The recorded baseline passed 187 frontend tests, lint, and the production build. The native guest/API/Realtime suite passed 189 assertions, including HTTP 409 conflicts, access isolation, trusted history, and cleanup. Production sign-in, persistence after refresh, and recovery are user-confirmed. Registered-user API repetition and broader browser/mobile acceptance were deferred; they are not reported as passes.

The optional native suite targets an explicitly named Supabase project:

```bash
npm run test:api -- --project your-project-ref
```

It creates four temporary guest accounts and six test groups using the public values in `.env.local`. It removes its groups and signs out in `finally`, then prints the path to a guarded account-cleanup SQL file under `.tmp/`. Run that exact cleanup file in SQL Editor to remove the four temporary Auth accounts. The manifest stores fixture IDs and statuses, not tokens. This suite is separate from normal unit tests; use a disposable project when possible.

## Deploy to Vercel

Import the GitHub repository into Vercel. `vercel.json` selects Vite, `npm ci`, `npm run build`, and `dist` output. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before deploying; changes to them require a new build. GitHub Actions runs lint, tests, and the production build.

For the current production app, set the Supabase **Site URL** to:

```text
https://northstar-six-zeta.vercel.app/
```

Add these **Redirect URLs**, retaining localhost entries for development:

```text
https://northstar-six-zeta.vercel.app/
https://northstar-six-zeta.vercel.app/?view=account&auth=upgrade
https://northstar-six-zeta.vercel.app/?view=account&auth=recovery
```

The app builds callbacks from the current browser origin. A localhost guest session does not automatically transfer to the production origin: register the guest, then sign in with that account on the hosted app.

## Structure and data model

```text
src/
  app/                   Application shell, navigation, and coordination
  features/              Auth, accounts, groups, board, tasks, labels, discussion, live updates
  shared/                Common controls, hooks, services, state, and generated types
  styles/                Small CSS files organized by feature and responsiveness
  test/                  Shared test setup and fixtures
supabase/
  schema.sql             Complete fresh-install application schema
  tests/api/             Optional native API/Realtime security checks
deliverables/
  GiaHuy_Pham_task_manager_assessment.pdf
```

Supabase manages Auth identities. Public profiles provide unique usernames, names, and colors; group memberships determine access. Groups own tasks, labels, assignments, comments, and activity. Members share task editing and invitations; the owner controls removal, ownership transfer, and deletion. Only accepted active members can be assigned tasks. Pending invitations expose a minimal preview without board access.

RLS controls reads, self-profile edits expose only editable fields, and checked RPCs perform other writes atomically. Composite foreign keys reject relationships across groups. Exact revision timestamps prevent lost updates; activity comes from committed database changes. Saved author/actor names survive renames and non-owner account deletion. Task/group deletion cascades to dependent content; member departure clears assignments while retaining shared work.

Edit `src/` for the app and `supabase/schema.sql` as the fresh-install database definition. `dist/` is generated by the build. This README and the schema contain the current setup; historical roadmaps, migration snapshots, reset scripts, and duplicate schema generators have been removed. Future changes to an existing database need a deliberate additive upgrade; reinstalling the clean schema is not a deployment or rollback procedure.

## Tradeoffs and limitations

- A guest cannot recover its identity after losing the browser session unless it registered first. Signing into another account switches identities without merging guest work.
- Dragging changes status; arbitrary ordering within a column is not persisted.
- Filters/statistics use the loaded group board. Larger datasets would benefit from server-side search, paging, and aggregates.
- Private live hints trigger authoritative refetches; offline writes retain drafts but are not queued for automatic synchronization.
- Initials/color avatars and in-app invitations are implemented. Image uploads, attachments, OAuth, and invitation emails are future additions.
- The recorded review leaves leaked-password protection disabled and a development-only minimatch advisory for follow-up. The last production-dependency audit found no vulnerabilities.
