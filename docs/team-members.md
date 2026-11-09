# Real members and assignees

Phases 15–16 replace manually created team profiles with actual accounts and accepted group membership. The `team` feature now contains reusable avatar and assignee controls; account editing lives in `features/account`, and group/member/invitation operations live in `features/groups`.

## Membership

Open **Members** in the selected group. Invite a registered account or guest by its exact unique username or account ID, review its identity, and send the request. The recipient accepts from **Invitations**. Pending invitees are neither board members nor assignment options.

All active members can edit tasks and invite. The owner can remove other members and transfer ownership. Own leave and confirmed deletion are on **Groups**; an owner must transfer or delete before leaving. **Edit my profile** opens Account; nobody can rename another person's identity.

## Assignment controls

The board strip shows accepted active accounts, with accessible name/username labels and overflow. Task cards show several assignee avatars. Pickers support multiple selections and search; usernames distinguish duplicate display names. Zero selection means Unassigned.

Task saves use the group-scoped atomic RPC. SQL rejects inactive, pending, or foreign-group assignees. A draft can remove an unavailable former selection. Leaving/removal clears persisted assignments and records removal history; shared tasks and saved names remain.

Use the [account/group setup and browser review](accounts-and-groups.md). The complete backend is already covered by the [Phase 13 API/security contract](group-security.md); no additional SQL is needed for these screens.
