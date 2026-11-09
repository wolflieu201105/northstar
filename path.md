# Task Manager Assessment — Step-by-Step Build Plan

Build a polished Kanban board with automatic guest accounts, private task storage in Supabase, and a live demo. This README is a work plan: check items off as you implement them. It does not describe an already completed app.

## 1. High-level roadmap

Follow this order. Finish each phase's **Done when** check before moving on. Phase 10 is optional; protect time for testing, deployment, and the final document.

| Phase | Main idea | Result |
| --- | --- | --- |
| 1 | Define scope and visual design | Decide what to build and how it should look. |
| 2 | Create the app and GitHub repository | Run a React + TypeScript project locally and commit it. |
| 3 | Set up Supabase | Create a free project and enable anonymous authentication. |
| 4 | Create the database and security rules | Store tasks and enforce ownership with RLS. |
| 5 | Connect guest authentication | Automatically create or restore the visitor's session. |
| 6 | Build the main board | Display four columns and reusable task cards. |
| 7 | Connect task actions to Supabase | Load, create, and update persistent tasks. |
| 8 | Add drag and drop | Move tasks between columns and save their status. |
| 9 | Polish the experience | Finish responsive layouts, loading, errors, and accessibility. |
| 10 | Add selected advanced features | Start with due dates, search, filters, and summary counts. |
| 11 | Test and deploy | Verify isolation and publish a working demo. |
| 12 | Prepare the submission | Document the solution, SQL, setup, and final links. |

**Suggested stack:** React + TypeScript + Vite, Supabase JS, a drag-and-drop library such as dnd kit, plain CSS or a styling tool you already know, GitHub, and a free hosting option from the assessment.

**Initial scope:** One board per guest. Email/password accounts, multiple projects, invitations, and a separate backend can be future improvements. Automatic guest sign-in is the required authentication flow.

### How to divide the work

- Work on one numbered phase or subsection at a time.
- If working with others, give each subsection one owner and agree on the task fields and component props first.
- Keep a short note under the active phase: `Owner: ___ | Status: ___ | Next action: ___`.
- Commit after each working milestone so you can return to it safely.
- Keep the confidential assessment brief out of the repository. Describe your own implementation in the public README.

## 2. Detailed implementation checklist

### Phase 1 — Define scope and visual design

#### 1.1 Decide the first complete version

- [ ] Include the four required columns: To Do, In Progress, In Review, Done.
- [ ] Include guest sessions, task creation, status changes by dragging, persistence, loading, and errors.
- [ ] Include description, priority, and due date in the task form if time allows.
- [ ] Choose the optional features you will attempt only after the required flow works.

#### 1.2 Sketch the interface

- [ ] Sketch a header with the board name, guest indicator, and Add task button.
- [ ] Sketch column headers with status markers and task counts.
- [ ] Sketch cards with title, priority, and optional due date.
- [ ] Sketch one task form that can later support editing.
- [ ] Choose a small set of colors, a font stack, spacing sizes, and corner radii; reuse them through CSS variables.
- [ ] Decide the narrow-screen layout: horizontal board scrolling or a selected-column view.

**Done when:** You can describe the required user journey and have a rough board and task-form layout.

### Phase 2 — Create the app and GitHub repository

#### 2.1 Create the frontend

- [ ] Install Node.js 22.12+ or a newer release supported by Vite, Supabase JS, and your template.
- [ ] Create the React + TypeScript app and start it locally.

```bash
npm create vite@latest task-manager -- --template react-ts
cd task-manager
npm install
npm run dev
```

- [ ] Remove the starter demo and create the app shell.
- [ ] Install the Supabase client. Add the drag-and-drop library when you reach Phase 8, using its current React documentation.
- [ ] Commit the package lockfile.

#### 2.2 Set up version control

- [ ] Create a GitHub repository and connect the local project.
- [ ] Ignore local environment files and build output; allow a placeholder-only `.env.example`.
- [ ] Push the initial app.

#### 2.3 Organize the code as it grows

Create files when needed; use this as a suggested structure.

| Location | Responsibility |
| --- | --- |
| `src/shared/lib/supabase.ts` | Shared Supabase client. |
| `src/features/tasks/types.ts` | Task, status, and priority types. |
| `src/features/auth/useGuestSession.ts` | Restore or create the guest session. |
| `src/features/tasks/services/tasks.ts` | Task database operations. |
| `src/features/tasks/hooks/useTasks.ts` | Task state, loading, and mutation handling. |
| `src/features/board/components/Board.tsx` | Board layout and drag/drop coordination. |
| `src/features/board/components/BoardColumn.tsx` | Column header, count, and drop area. |
| `src/features/tasks/components/TaskCard.tsx` | Task presentation and interactions. |
| `src/features/tasks/components/TaskForm.tsx` | Creation and optional editing form. |
| `src/styles/` | Shared tokens, layout, and component styles. |
| `supabase/schema.sql` | Reproducible application tables, constraints, grants, indexes, and policies. |

**Done when:** The app runs locally, GitHub contains the starter project, and environment files are excluded.

### Phase 3 — Set up Supabase

#### 3.1 Create the hosted project

- [ ] Create a Supabase project on the free tier.
- [ ] Save the database password securely outside the repository.
- [ ] Enable anonymous sign-ins in the authentication settings.

#### 3.2 Connect the frontend configuration

- [ ] Copy the project URL and a browser-safe public API key.
- [ ] The brief calls this the public `anon` key; Supabase also provides newer publishable keys. Use a supported public key and name the environment variable consistently.
- [ ] Put the values in an ignored `.env.local` file.
- [ ] Create `.env.example` containing placeholders only.
- [ ] Create the shared Supabase client and a clear missing-configuration message.

Example variable names if using the public anon key:

```dotenv
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

Frontend environment variables are included in the browser bundle. Use only a public key here; never use a service-role key, secret key, or database password.

**Done when:** The app can initialize its Supabase client and anonymous sign-in is enabled in the project.

### Phase 4 — Create the database and security rules

#### 4.1 Define the task fields

- [ ] Create the `tasks` table using the following model.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated automatically. |
| `title` | `text` | Required; reject empty or whitespace-only titles. |
| `status` | `text` | Required; default `todo`; restrict to the four status values below. |
| `user_id` | `uuid` | Required; references `auth.users(id)`; identify the owning guest. |
| `created_at` | `timestamptz` | Required; default to the current time. |
| `description` | `text` | Optional enhancement. |
| `priority` | `text` | Recommended; default `normal`; restrict to `low`, `normal`, `high`. |
| `due_date` | `date` | Optional calendar date. |

| Display label | Stored status |
| --- | --- |
| To Do | `todo` |
| In Progress | `in_progress` |
| In Review | `in_review` |
| Done | `done` |

- [ ] Decide what happens to tasks when their owning auth user is deleted; cascading deletion is a simple choice.
- [ ] Add an index starting with `user_id` for the ownership-filtered task query.
- [ ] Use a stable initial sort such as creation time and ID. Add a `position` field only if implementing persistent manual ordering within columns.

#### 4.2 Enforce ownership in the database

- [ ] Enable Row Level Security on `tasks`.
- [ ] Grant the `authenticated` role only the task operations the app uses.
- [ ] Confirm the table is exposed through the project's Data API settings; table grants and RLS policies must both be configured.
- [ ] Add policies with the following behavior.

| Operation | Ownership rule |
| --- | --- |
| SELECT | `USING`: `auth.uid() = user_id`. |
| INSERT | `WITH CHECK`: `auth.uid() = user_id`. |
| UPDATE | Both `USING` and `WITH CHECK`: `auth.uid() = user_id`. |
| DELETE | `USING`: `auth.uid() = user_id`, if deletion is implemented. |

Anonymous **signed-in guests use the `authenticated` database role**. A policy that merely allows that role does not isolate users; the ownership condition provides isolation. Keep the SELECT policy so updates can find permitted rows.

- [ ] Save all application SQL, including RLS, grants, constraints, and indexes, in `supabase/schema.sql`.
- [ ] Check table access through a guest client after Phase 5. The dashboard SQL editor may run with privileges that bypass RLS.

**Done when:** The schema and policies exist, and the SQL needed to reproduce them is saved. Verify actual guest access in Phases 5 and 11.

### Phase 5 — Connect guest authentication

#### 5.1 Restore or create a session

- [ ] On startup, check for an existing Supabase session.
- [ ] Reuse the existing session when available.
- [ ] Otherwise call `supabase.auth.signInAnonymously()`.
- [ ] Prevent duplicate initialization calls, including React development-mode effect reruns.
- [ ] Load tasks only after authentication succeeds.

#### 5.2 Handle authentication states

- [ ] Show a loading state while the session initializes.
- [ ] Show an actionable error and Retry button if it fails.
- [ ] Display a subtle guest indicator after success.
- [ ] Confirm a refresh keeps the same guest identity.
- [ ] Document that clearing browser data or using another browser/device creates a separate guest experience; account recovery requires linking a permanent identity.

**Done when:** Opening the app automatically produces a guest session, refreshing preserves it, and a separate browser profile gets a different user ID.

### Phase 6 — Build the main board

#### 6.1 Build reusable UI pieces

- [ ] Create the header, board, column, card, and task-form components.
- [ ] Use a few temporary in-memory tasks to develop the layout.
- [ ] Group tasks by stored status and show the four columns in the required order.
- [ ] Show a count per column and a useful empty-column state.
- [ ] Add an Add task entry point in the header or columns.

#### 6.2 Establish the visual hierarchy

- [ ] Make task titles easy to scan and secondary metadata quieter.
- [ ] Keep card spacing, borders, icons, and badges consistent.
- [ ] Give buttons and cards clear hover and focus states.
- [ ] Test long titles, empty columns, and columns with many tasks.

**Done when:** The board looks intentional with both populated and empty columns, and the task form opens and closes correctly.

### Phase 7 — Connect task actions to Supabase

#### 7.1 Read tasks

- [ ] Fetch the signed-in guest's tasks through the task service.
- [ ] Include a `user_id` filter for query clarity; RLS remains the security boundary.
- [ ] Replace temporary board data with the response.
- [ ] Distinguish loading, load failure, and a genuinely empty board.

#### 7.2 Create tasks

- [ ] Require a trimmed, nonempty title.
- [ ] Support status and any chosen description, priority, and due-date fields.
- [ ] Set `user_id` from the guest session.
- [ ] Disable duplicate submissions while saving.
- [ ] Add the saved row to the board or refetch after success.
- [ ] Keep the entered form values and show an error if saving fails.

#### 7.3 Support status updates and optional management

- [ ] Implement a reusable task-status update operation for Phase 8.
- [ ] Add editing using the same form if time permits.
- [ ] Add deletion with confirmation or undo if time permits.
- [ ] Keep board state consistent after each successful operation.

**Done when:** A guest can create a task and still see it after refreshing. Implemented edits or deletions also persist.

### Phase 8 — Add drag and drop

#### 8.1 Implement column changes

- [ ] Use the chosen library's current React setup for draggable cards and droppable columns.
- [ ] Give every card a stable task ID and every column a stable status ID.
- [ ] Allow dropping into empty columns and onto occupied columns.
- [ ] Show a drag preview and highlight the intended drop area.
- [ ] Distinguish a card click from starting a drag.

#### 8.2 Save each completed move

- [ ] On a valid drop, calculate the destination status.
- [ ] Ignore canceled drops and drops that do not change status.
- [ ] Update the board immediately and save the new status to Supabase.
- [ ] On failure, restore the previous state and show a retryable error.
- [ ] Prevent overlapping moves for a task while its previous move is saving, or handle their ordering explicitly.
- [ ] Offer a status selector in the task form as a keyboard/mobile alternative.

Saving on drop meets the assessment requirement. Cross-tab live synchronization can be an optional extension; it is not needed for this first complete version. Persistent reordering within a column is also separate from changing status.

**Done when:** Tasks move across all four columns, retain their status after refresh, and return to their previous column if saving fails.

### Phase 9 — Polish the experience

#### 9.1 Finish application states

- [ ] Add board/card skeletons or a deliberate loading indicator.
- [ ] Add an empty-board message with a Create your first task action.
- [ ] Separate an empty column from a filtered search with no matches.
- [ ] Show load/save errors near the relevant action with a clear recovery path.
- [ ] Use restrained transitions and honor reduced-motion preferences.

#### 9.2 Check usability and responsiveness

- [ ] Test the board on desktop and a narrow mobile viewport.
- [ ] Keep mobile controls usable without tiny targets or clipped dialogs.
- [ ] Give inputs visible labels, icon buttons accessible names, and controls visible focus.
- [ ] For dialogs, support Escape, sensible focus management, and returning focus to the opener.
- [ ] Check contrast and pair status/urgency colors with text or icons.
- [ ] Verify keyboard task creation and status changes.

**Done when:** The core flow remains understandable on narrow screens, during loading, and after a failed request.

### Phase 10 — Add selected advanced features (optional)

Start with **10.1–10.3** for useful improvements with limited schema work. Add the other features only when the required app, testing, and submission are on track.

#### 10.1 Due-date indicators

- [ ] Use the saved `due_date` on each task.
- [ ] Show distinct overdue, due-today, and upcoming states; define the upcoming window, such as three days.
- [ ] Compare calendar dates in the user's local timezone to avoid off-by-one-day display errors.
- [ ] Exclude Done tasks from overdue warnings and counts.

#### 10.2 Search and priority filtering

- [ ] Add case-insensitive title search and a priority filter.
- [ ] Combine active filters and provide a Clear filters action.
- [ ] Derive filtered tasks from the loaded task data so hidden tasks remain intact.
- [ ] Show a no-matches state and make count behavior clear.

#### 10.3 Board summary

- [ ] Show total, completed, and overdue task counts.
- [ ] Derive counts from current task state so they update after mutations.
- [ ] Label whether counts cover the whole board or the filtered view.

#### 10.4 Team members and assignees

- [ ] Create guest-owned `team_members` records with name and optional avatar color.
- [ ] Add a small member-management form and avatar list.
- [ ] Start with one optional `assignee_id` per task; use a join table only if supporting multiple assignees.
- [ ] Enforce that a task's assignee belongs to the same guest, using database constraints or checks as well as UI filtering.
- [ ] Enable RLS on the new table and test ownership isolation.

For this assessment, team members can be guest-managed profiles. Actual shared accounts and invitations require a separate collaboration access model.

#### 10.5 Labels and tags

- [ ] Create guest-owned `labels` and a `task_labels` join table.
- [ ] Add label creation, task assignment, card chips, and filtering.
- [ ] Protect both tables with RLS and reject relationships to another guest's tasks or labels.

#### 10.6 Task comments

- [ ] Create `comments` with ID, task ID, owner ID, body, and creation timestamp.
- [ ] Add a task-detail panel with a comment form and oldest-first comments.
- [ ] Reject blank comments and preserve the draft on failure.
- [ ] Enforce ownership of the parent task; remove related comments when a task is deleted.

#### 10.7 Task activity log

- [ ] Define events for creation, status changes, edits, or assignments.
- [ ] Store task ID, owner ID, event details, and timestamp.
- [ ] Record the change and its activity together, for example using a database trigger or transaction.
- [ ] Show readable entries such as “Moved from To Do to In Progress.”
- [ ] Apply parent-task ownership rules and prevent clients from rewriting history.

**Done when:** Every chosen feature works through refreshes, has appropriate error handling, and any added tables have tested RLS. Skip unfinished extras in the submitted feature list.

### Phase 11 — Test and deploy

#### 11.1 Verify the complete required flow

- [ ] New visitor: guest session initializes and an empty board appears.
- [ ] Create: a valid task appears; blank titles are rejected.
- [ ] Refresh: saved tasks and statuses remain.
- [ ] Drag: move into occupied and empty columns; cancel a drag safely.
- [ ] Failure: simulate a failed read/save and verify the recovery behavior.
- [ ] Narrow screen: create a task and change its status successfully.
- [ ] Run the project's lint/type checks and production build; fix failures.

#### 11.2 Verify isolation using real guest clients

- [ ] Open the app in a regular browser profile for Guest A and a separate profile or private session for Guest B.
- [ ] Have each guest create a different task and verify that neither sees the other's tasks.
- [ ] Through Guest B's client, try reading, changing, and deleting a known Guest A task ID; confirm A's row stays inaccessible and unchanged.
- [ ] Try inserting a task with A's owner ID through B's client; confirm rejection.
- [ ] Try changing B's task owner to A; confirm rejection.
- [ ] Perform equivalent checks for any optional tables and cross-owner relationships.

Use guest access tokens for these checks. Hiding another user's cards in the interface does not verify database security. Note that an unauthorized update may affect zero rows rather than return a visible error.

#### 11.3 Deploy the frontend

- [ ] Push the tested source to GitHub.
- [ ] Connect the repository to an allowed free hosting option, such as Vercel's Hobby plan where eligible; keep paid options disabled.
- [ ] Set the same public Supabase configuration in the hosting environment.
- [ ] For a standard Vite app, configure the build as `npm run build` and output directory as `dist`.
- [ ] Deploy and verify the live app in a fresh browser session without your hosting account.
- [ ] Repeat create, move, refresh, and guest-isolation checks on the live URL.
- [ ] Record the exact live URL and GitHub URL for the submission.

**Done when:** A reviewer can open the live URL, use the board immediately, and see persistent private tasks.

### Phase 12 — Prepare the final submission

#### 12.1 Turn this plan into a finished-project README

- [ ] Replace planned features with an accurate overview of what you built.
- [ ] Add the live URL, repository URL, and optionally a screenshot of your own app.
- [ ] Document prerequisites, install/run commands, environment variables, anonymous-auth setup, and how to apply `supabase/schema.sql`.
- [ ] Verify those instructions against a clean checkout.
- [ ] List implemented advanced features and known limitations.

#### 12.2 Create the required PDF or DOCX

- [ ] Use the required filename pattern: `firstname_lastname_task_manager_assessment.pdf` for a PDF submission.
- [ ] Include a short solution overview and the reasons behind the design choices.
- [ ] Include clickable live-app and GitHub links.
- [ ] Include the **full application SQL**, including optional tables, constraints, indexes, grants, RLS policies, and any triggers/functions. Do not rely only on a repository link or screenshot.
- [ ] Include the local setup instructions and implemented advanced features.
- [ ] Explain tradeoffs and improvements you would make with more time.
- [ ] Check that links work and no privileged credentials or confidential brief are included.

**Done when:** The document contains every requested item and matches the final deployed app.

## 3. Time budget and stopping points

These are planning targets for a familiar stack. Track actual time and drop optional scope first if a phase takes longer.

| Work | Target |
| --- | --- |
| Scope, design, app, and repository — Phases 1–2 | 35 minutes |
| Supabase, schema, RLS, and guest auth — Phases 3–5 | 70 minutes |
| Board and persistent task creation — Phases 6–7 | 65 minutes |
| Drag and drop — Phase 8 | 40 minutes |
| Design refinement and state handling — Phase 9 | 40 minutes |
| Verification and deployment — Phase 11 | 60 minutes |
| README and final document — Phase 12 | 30 minutes |
| **Required app and submission target** | **5 hours 40 minutes** |

Add selected Phase 10 features only if the remaining time supports them. The assessment allows up to 12 hours if the stack is unfamiliar.

### Milestones

- [ ] **Foundation:** The app runs, the schema is secured, and guest sign-in works.
- [ ] **Persistent board:** Tasks can be created, viewed, and restored after refresh.
- [ ] **Complete core:** Drag/drop, loading, errors, and responsive behavior work.
- [ ] **Ready to submit:** Isolation is verified, the app is live, and the document is finished.
- [ ] **Optional enhancements:** Selected advanced features are complete and documented.

## 4. Official references

Check the current documentation while implementing; library APIs and hosting settings can change.

- [Vite setup and supported Node.js versions](https://vite.dev/guide/)
- [Supabase anonymous sign-in](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Data API access](https://supabase.com/docs/guides/api/securing-your-api)
- [dnd kit documentation](https://dndkit.com/)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Vite deployment guide](https://vite.dev/guide/static-deploy.html)
