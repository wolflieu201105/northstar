# Accounts and shared groups — Phases 14–16

These phases connect the installed Phase 13 backend to real accounts, accepted group membership, and the existing board. The user confirmed the SQL verification on November 9, 2026. This batch adds no SQL migration or dependencies. Do not rerun `reset.sql`: it would erase the new group data.

Phase 17 now adds [live updates and recovery](realtime.md). Its additive SQL/private-channel setup is a separate checkpoint; the account configuration below stays the same.

## Supabase Auth setup

Keep the current project URL and browser publishable key in `.env.local`. In the Supabase dashboard's Authentication settings:

1. Keep **anonymous sign-ins** enabled.
2. Enable the **Email / Password** provider.
3. Enable **Allow manual linking**. Guest registration uses native `updateUser({ email })` on the current guest, followed by password setup.
4. Set the **Site URL** to the origin you are testing, usually `http://localhost:5173`.
5. In **Redirect URLs**, add `http://localhost:5173/**`. If Vite uses another port, allow that exact local origin too. Add your deployed origin before testing there; use exact production callback URLs rather than a broad production wildcard:
   - `https://your-app.example/?view=account&auth=upgrade`
   - `https://your-app.example/?view=account&auth=recovery`
   The installed SDK may append its reserved `sb_flow_id` parameter. Ensure your allowed redirect pattern accommodates that query parameter, for example an exact production origin/path with a query wildcard.
6. Keep Supabase's native confirmation rules as configured. If email confirmation is required, open the email in the browser that started registration/recovery. There is no separate application verification system. Check native email templates and email delivery/SMTP if a link does not arrive.
7. Review the project's password-strength settings. The UI requires at least eight characters; Supabase remains authoritative for server password rules. The read-only hosted advisor still reports leaked-password protection disabled. Enable it if supported by your project plan; no Auth settings were changed by the agent.

The app explicitly consumes PKCE callbacks, including `sb_flow_id`, and removes callback credentials from the visible URL before workspace navigation starts. Native recovery events also select password setup. Expired/incomplete links show an error and do not create another guest.

Official references: [anonymous account conversion](https://supabase.com/docs/guides/auth/auth-anonymous), [password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), and [password security](https://supabase.com/docs/guides/auth/password-security).

## Account flows

- A first visit restores the Supabase session or starts a guest. **Sign out** shows the entry screen; it does not immediately create a replacement guest. **Continue as guest** explicitly starts one.
- **Account** shows the copyable Auth UUID and editable globally unique username, display name, and avatar color. Duplicate display names are allowed; pickers show usernames too.
- **Register current guest** links an email to the current identity. If required, confirm the native email, then set/confirm a password. The Auth UUID, memberships, tasks, comments, and history remain attached to that identity.
- Non-secret registration progress (UUID/email) survives reload. **Resend confirmation** and **I’ve confirmed my email** resume setup. Passwords are held only in form state; session tokens use Supabase's native persistence.
- Signing into an existing account deliberately switches identity. A guest must acknowledge that its work stays with that guest and is not merged. Register it first to retain access from another browser.
- **Forgot password?** requests a native recovery email. A successful callback opens explicit new-password/confirmation fields. A failed callback cannot enable recovery on the previous account.

## Groups and invitations

The header switcher and **Groups** page list joined groups, including the initial empty private group. Create more groups, open a board, rename the selected group, or manage its members.

**Members** replaces manual profile creation. Find an actual registered or guest account by exact username or account UUID, review the resolved name/username/ID, then send the request. **Invitations** shows incoming and authorized sent requests, with paginated history and explicit refresh/retry. Only the recipient can accept/decline. Senders and owners may revoke their authorized pending requests. The UI displays the actual resolved status if accept/revoke races another action.

All active members edit tasks, manage labels, and invite accounts. Owners additionally remove other members, transfer ownership to an active member, and delete the group after confirmation. An owner must transfer ownership or delete the group before leaving. Departure/removal clears assignments in the database, retaining shared tasks and historical author names.

## Group-scoped workspace

- Queries use `group_id`; mutations use the installed group RPCs. Assignees come from accepted active memberships and resolve to real profiles.
- Stores and detail pagination are isolated by Auth UUID and group (plus task for discussion). Late reads from an earlier identity/group cannot replace the active view.
- Switching groups clears incompatible task overlays, checks unsaved drafts and pending saves, and restores that group's filters and scroll from memory. Current filters/direct links also survive refresh through the URL. Other groups' remembered filters are intentionally not copied to another account.
- Tasks and labels use exact server revision strings for edits/deletes. Stale drafts remain visible; task and label editors offer explicit adoption of the latest version.
- Comments display saved `author_name`; activity displays `actor_name` and version 2 assignment/name snapshots. Current profile changes do not rewrite history.
- Focus/visibility changes, manual refresh, and authorization failures revalidate access. A successful directory refresh that confirms removal clears the board/details even with a dirty draft; a temporary network failure retains the current draft.

Phase 17 adds private subscriptions, background updates, periodic access checks, and reconnect recovery. Follow the [Realtime setup and review](realtime.md). The existing refresh buttons remain available; Phases 14–16 alone still use manual/focus refresh.

## Manual review checkpoint

Run `npm run dev`, then use two independent browser profiles (A and B):

1. In each **Account**, choose a different username and copy its account ID. Confirm each starts with a separate private group.
2. In A, create/open a group. In **Members**, resolve B by username (then try its account ID), review the preview, and send. B should have no board access while pending.
3. In B, refresh **Invitations**, accept, then open the shared group from **Groups**. Both accounts should appear as real assignees.
4. Create/edit/move tasks, assign both users, tag labels, and post comments as both accounts. Refresh the other browser and check saved author/activity names. Confirm private-group tasks stay private.
5. Switch between two groups with different filters and an open dirty task. Cancel a discard once, then accept. Check the board, counts, selected task, filters, and scroll belong to the selected group.
6. In A's guest, create work, record the UUID, then register it using a real accessible email. Complete native confirmation/password setup, refresh, and verify the UUID/work/memberships are unchanged. Sign in from another browser. Try duplicate username/email, weak/mismatched password, and an expired/resend link.
7. Try password recovery, explicit sign-out, and sign-in to a different account. No previous account's task/dialog/filter state should appear.
8. Test owner transfer, own leave, removal, and confirmed deletion. Remove B while B has a dirty detail open; focus B or use refresh and confirm the inaccessible content clears. Membership permissions are enforced independently by SQL.
9. Go offline before task/comment/label/profile saves. Drafts remain; retry after reconnect. Conflicting edits should require review of the latest revision.

Local tests cover mocked native Auth, HTTP wire contracts, group/account stale-response isolation, draft guards, invitation retries/status resolution, member presentation, labels/comments/activity, filters/dates/stats, and access-loss composition. Type checks, lint, and the production build are also required. Real email delivery, actual guest conversion across browsers, keyboard/touch/appearance, and real JWT/Data API isolation remain manual/Phase 18 checks; a mocked test is not proof of hosted Auth configuration.

The current read-only security advisor shows intentional authenticated-guest policy notices, a policy-free private quota table (all API grants revoked), and the disabled leaked-password setting above. No hosted schema/data/Auth settings were changed by this batch.
