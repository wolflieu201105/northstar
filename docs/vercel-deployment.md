# Deploy Northstar to Vercel

The repository is `https://github.com/wolflieu201105/northstar`. Vercel hosts the Vite frontend; the existing Supabase project continues to provide Auth, the database, and Realtime. The user confirmed the Phase 18 SQL verifier is correct. No additional SQL or database reset is required for hosting.

Deployment preparation is ready, but no Vercel deployment has been created by the agent. The connected Vercel app currently requires authorization for the account scope before it can inspect or deploy projects. Dashboard deployment below works independently of that connection.

## Import the GitHub repository

1. Commit and push the deployment files to the intended branch of `wolflieu201105/northstar`.
2. Sign in to [Vercel's new-project screen](https://vercel.com/new), connect GitHub if needed, and import `northstar`. Select the account/team that should own the app.
3. Use the repository root (`./`). Confirm these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 24.x, matching the verified local Node major |

The included `vercel.json` records the framework and build settings. Views and task links use root query parameters, so this app currently needs no path rewrite. You do not upload `dist` manually in this Git workflow. Vercel installs dependencies and builds it from source. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Git deployments](https://vercel.com/docs/git).

4. Before clicking Deploy, add these environment variables using the same public values as `.env.local`:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Your existing Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your existing browser publishable key |

Apply them to Production. Add Preview too only when those builds should use this same live database. Enter values without wrapping quotes. No service-role key or database password is needed. Vite compiles `VITE_*` values into public JavaScript; `.env.local` remains ignored. Changes to these values need a new deployment ([Vite environment behavior](https://vite.dev/guide/env-and-mode)).

5. Click Deploy and wait for Ready. Copy the stable production domain from the project, for example `https://your-project.vercel.app`, rather than a temporary commit-specific preview URL.

## Set the production Auth URLs

In the existing Supabase project, open **Authentication → URL Configuration**.

- Set **Site URL** to the exact stable production origin with a trailing slash, for example `https://your-project.vercel.app/`.
- Add these **Redirect URLs**, replacing the example hostname with the actual production hostname:

```text
https://your-project.vercel.app/
https://your-project.vercel.app/?view=account&auth=upgrade
https://your-project.vercel.app/?view=account&auth=recovery
```

Keep the localhost entries needed for development. The frontend already builds its upgrade/recovery callbacks from the current browser origin, so no new frontend URL variable is required. If a custom domain is added later, add its exact callbacks and update Site URL too. Test confirmation/recovery on each intended origin; do not use an unrestricted `https://**.vercel.app/**` allow-list entry. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Check the first hosted build

1. Open the production URL and confirm the board/configuration screen loads without a Supabase configuration error.
2. Sign in, create or select a group, add a task, and refresh. Open a group/task link directly and refresh again.
3. Invite another account, accept in a second browser, and check tasks, assignments, comments, activity, and the Live updates status.
4. Test guest registration and recovery links on the hosted origin. Verify stale edits return a prompt conflict after the Phase 18 SQL fix.

A guest session created on localhost is stored under the localhost origin. It does not automatically appear on the Vercel origin. Register that guest and sign in with the same account on the deployed app to keep access to its existing groups and work. Avoid opening a second guest and expecting it to have the first guest's account ID.

This deployment is the next review checkpoint, not a claim that all Phase 18 acceptance gates are complete. The full hosted conflict rerun, registered-user API repetition, native email flows, and browser/mobile review remain in [the verification report](phase18-verification.md). Once deployed, record the actual project, domain, source commit, and observed results there. Do not run destructive reset SQL as a deployment step or routine rollback.

The `.vercelignore` file also excludes local environment files, temporary test fixtures, and generated output from a future CLI source upload. The `.vercel` linking/settings directory is ignored by Git.
