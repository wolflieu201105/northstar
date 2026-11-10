import { randomUUID } from 'node:crypto'
import { allowed, check, denied, eventually, hidden, join } from './checks.mjs'
import { verifyRevisionConflicts } from './verify-conflicts.mjs'

const taskSelect = '*,task_assignments(member:group_members!task_assignments_active_member_fkey(profile:profiles!group_members_user_id_fkey(id,username,display_name,avatar_color))),task_labels(label:labels!task_labels_label_fkey(*))'
const tables = ['groups', 'group_members', 'tasks', 'labels', 'task_assignments', 'task_labels', 'comments', 'task_activity']

export async function verifyAccess(fixtures) {
  const people = []
  for (const name of ['A','B','C','D']) people.push(await fixtures.guest(name))
  const [A, B, C, D] = people
  const anon = fixtures.anonymous()
  const G = await fixtures.group(A, 'shared G')
  const H = await fixtures.group(A, 'private H')
  const rpc = (who, name, args, label = name) => allowed(who.client.rpc(name, args), label)
  const invite = (who, recipient) => rpc(who, 'send_group_invitation', { p_group_id: G, p_recipient_user_id: recipient.id, p_invitation_id: randomUUID() })
  const accept = (who, id) => rpc(who, 'respond_group_invitation', { p_invitation_id: id, p_accept: true })
  const save = (who, task, changes = {}, relations = {}, group = G) => who.client.rpc('save_task', {
    p_group_id: group, p_task_id: task.id, p_changes: changes, p_expected_updated_at: task.updated_at, ...relations,
  })
  const history = () => allowed(A.client.from('task_activity').select('*').eq('task_id', task.id).order('created_at').order('id'), 'read trusted history')

  const inviteB = await invite(A, B)
  await denied(C.client.rpc('respond_group_invitation', { p_invitation_id: inviteB.id, p_accept: true }), 'cannot accept another recipient invitation')
  await hidden(B.client.from('groups').select('*').eq('id', G), 'pending membership hides group')
  const inbox = await rpc(B, 'list_group_invitations', {})
  check(inbox.some((row) => row.id === inviteB.id && row.group_name.includes('shared G')), 'pending recipient sees preview')
  await accept(B, inviteB.id)
  await accept(B, inviteB.id)
  const inviteD = await invite(B, D)
  await accept(D, inviteD.id)
  const inviteC = await invite(B, C)
  await denied(A.client.rpc('send_group_invitation', { p_group_id: G, p_recipient_user_id: A.id }), 'self invitation denied', '22023')
  await denied(C.client.from('group_members').insert({ group_id: G, user_id: C.id }), 'direct membership denied')

  const label = await rpc(A, 'save_label', { p_group_id: G, p_label_id: randomUUID(), p_name: 'API label' })
  const privateLabel = await rpc(A, 'save_label', { p_group_id: H, p_label_id: randomUUID(), p_name: 'Private label' })
  let task = await rpc(A, 'save_task', { p_group_id: G, p_task_id: randomUUID(), p_changes: { title: 'API shared task' }, p_assignee_ids: [A.id, D.id], p_label_ids: [label.id] })
  const privateTask = await rpc(A, 'save_task', { p_group_id: H, p_task_id: randomUUID(), p_changes: { title: 'API private task' } })
  check(task.created_by_user_id === A.id && task.created_by_name === 'Phase18 A', 'actual task creator')
  const nested = await allowed(B.client.from('tasks').select(taskSelect).eq('id', task.id).single(), 'real nested membership query')
  check(nested.task_assignments.length === 2 && nested.task_labels[0].label.id === label.id, 'nested relations resolve')
  check(nested.task_assignments.every((link) => link.member.profile.id), 'nested real profiles resolve')
  check(!Object.hasOwn(nested.task_assignments[0].member.profile, 'email'), 'no private Auth email in profiles')

  for (const table of tables) {
    await hidden(C.client.from(table).select('*').eq(table === 'groups' ? 'id' : 'group_id', G), `pending guest cannot read ${table}`)
    await hidden(B.client.from(table).select('*').eq(table === 'groups' ? 'id' : 'group_id', H), `member cannot read private ${table}`)
    await denied(anon.from(table).select('*'), `API key alone cannot read ${table}`)
  }
  await denied(anon.from('profiles').select('*'), 'API key alone cannot read profiles')
  await denied(anon.rpc('lookup_invitation_target', { p_group_id: G, p_query: A.id }), 'anonymous lookup denied')
  await hidden(C.client.from('profiles').select('*').eq('id', A.id), 'no global profile directory')
  const lookup = await rpc(B, 'lookup_invitation_target', { p_group_id: G, p_query: C.id })
  check(lookup.id === C.id && !Object.hasOwn(lookup, 'email'), 'exact ID lookup excludes email')
  const usernameLookup = await rpc(B, 'lookup_invitation_target', { p_group_id: G, p_query: ` ${lookup.username.toUpperCase()} ` })
  check(usernameLookup.id === C.id, 'unique username lookup normalized')
  await hidden(B.client.from('profiles').update({ display_name: 'Forged name' }).eq('id', A.id).select('*'), 'other profile update returns zero rows')
  const profileA = await allowed(A.client.from('profiles').select('display_name').eq('id', A.id).single(), 'read own profile')
  check(profileA.display_name === 'Phase18 A', 'zero-row update changed nothing')

  const initialEvents = await history()
  await denied(save(A, task, { title: 'Atomic rejection' }, { p_label_ids: [privateLabel.id] }), 'cross-group label rejected even when caller belongs to both')
  await denied(save(A, privateTask, { title: 'Cross parent' }), 'cross-group task rejected even when caller belongs to both', 'P0002')
  await denied(save(A, task, {}, { p_assignee_ids: [C.id] }), 'pending assignee denied')
  await denied(save(B, task, { created_by_user_id: C.id }), 'creator forgery rejected', '22023')
  await denied(save(B, task, { updated_at: new Date().toISOString() }), 'timestamp forgery rejected', '22023')
  await denied(B.client.from('groups').update({ owner_user_id: B.id }).eq('id', G), 'direct ownership forgery denied')
  await denied(B.client.from('tasks').update({ title: 'Forged direct edit' }).eq('id', task.id), 'direct task mutation denied')
  await denied(B.client.from('task_assignments').insert({ group_id: G, task_id: privateTask.id, assignee_user_id: B.id }), 'direct cross-parent assignment denied')
  check((await history()).length === initialEvents.length, 'failed saves append no activity')
  const unchanged = await allowed(B.client.from('tasks').select('*').eq('id', task.id).single(), 'read after failed transaction')
  check(unchanged.title === task.title && unchanged.updated_at === task.updated_at, 'atomic rejection retains fields and revision')
  const noop = await allowed(save(B, task), 'no-op save')
  check(noop.updated_at === task.updated_at && (await history()).length === initialEvents.length, 'no-op retains token and event count')

  // Native WebSocket checks, including a denied join that must never SUBSCRIBE.
  const messages = []
  const memberChannel = B.client.channel(`northstar:group:${G}`, { config: { private: true } })
    .on('broadcast', { event: 'board' }, ({ payload }) => messages.push(payload))
  check(await join(memberChannel) === 'SUBSCRIBED', 'accepted member joins private channel')
  const pendingChannel = C.client.channel(`northstar:group:${G}`, { config: { private: true } })
  check(await join(pendingChannel) === 'CHANNEL_ERROR', 'pending guest private join rejected')
  const ownAccount = C.client.channel(`northstar:account:${C.id}`, { config: { private: true } })
  check(await join(ownAccount) === 'SUBSCRIBED', 'own account channel joins')
  const otherAccount = C.client.channel(`northstar:account:${A.id}`, { config: { private: true } })
  check(await join(otherAccount) === 'CHANNEL_ERROR', 'another account topic rejected')

  const oldToken = task.updated_at
  task = await allowed(save(B, task, { status: 'in_progress', description: 'Shared edit' }, { p_assignee_ids: [A.id, B.id, D.id, B.id] }), 'member edits shared task')
  check(task.assignees.length === 3, 'duplicate assignments normalized')
  await eventually(() => messages.length > 0, 'committed change arrives over actual WebSocket')
  // Hosted realtime.send adds its own message UUID to the empty application payload.
  check(messages.every((payload) => payload && Object.keys(payload).every((key) => key === 'id')
    && (payload.id === undefined || /^[0-9a-f-]{36}$/i.test(payload.id))), 'broadcast payloads contain only transport metadata')
  if (!process.argv.includes('--skip-conflicts')) {
    await verifyRevisionConflicts({ editor: A.client, reader: B.client, groupId: G, task, oldToken, label })
  } else console.log('SKIP: stale-revision HTTP check until the Phase 18 migration is applied.')
  const events = await history()
  check(events.some((event) => event.event_type === 'status_changed' && event.actor_user_id === B.id && event.actor_name === 'Phase18 B'), 'history records actual member actor')

  const commentId = randomUUID()
  const commentArgs = { p_group_id: G, p_task_id: task.id, p_comment_id: commentId, p_body: 'Native API comment' }
  const comment = await rpc(B, 'post_comment', commentArgs)
  await rpc(B, 'post_comment', commentArgs)
  check(comment.author_user_id === B.id && comment.author_name === 'Phase18 B', 'actual comment author')
  const comments = await allowed(A.client.from('comments').select('*').eq('id', commentId), 'comment retry readback')
  check(comments.length === 1, 'same comment ID creates one row')
  await denied(A.client.rpc('post_comment', commentArgs), 'comment author forgery retry denied')
  await denied(B.client.rpc('post_comment', { ...commentArgs, p_task_id: privateTask.id, p_comment_id: randomUUID() }), 'comment parent mismatch denied', 'P0002')
  await denied(B.client.rpc('post_comment', { ...commentArgs, p_comment_id: randomUUID(), p_body: ' ' }), 'blank comment rejected', '23514')
  await denied(B.client.from('comments').update({ body: 'Tampered' }).eq('id', commentId), 'comments append-only')
  await denied(B.client.from('comments').delete().eq('id', commentId), 'comments cannot be directly deleted')
  await denied(B.client.from('task_activity').insert({ group_id: G, task_id: task.id, actor_user_id: B.id, actor_name: 'Forged', event_type: 'created', payload: {} }), 'activity insertion denied')
  await denied(B.client.from('task_activity').update({ actor_name: 'Forged' }).eq('id', events[0].id), 'activity edit denied')
  await denied(B.client.from('task_activity').delete().eq('id', events[0].id), 'activity deletion denied')

  const archived = await rpc(B, 'save_label', { p_group_id: G, p_label_id: label.id, p_archived: true, p_expected_updated_at: label.updated_at })
  task = await allowed(save(B, task, { title: 'Existing archived link' }, { p_label_ids: [archived.id] }), 'existing archived label retained')
  const otherTask = await rpc(B, 'save_task', { p_group_id: G, p_task_id: randomUUID(), p_changes: { title: 'Member-created task' } })
  await denied(save(B, otherTask, {}, { p_label_ids: [archived.id] }), 'new archived label attachment denied')
  await denied(B.client.rpc('delete_group', { p_group_id: G }), 'non-owner group deletion denied')
  await rpc(A, 'transfer_group_ownership', { p_group_id: G, p_user_id: B.id })
  await denied(A.client.rpc('remove_group_member', { p_group_id: G, p_user_id: D.id }), 'former owner cannot remove members')
  await rpc(B, 'remove_group_member', { p_group_id: G, p_user_id: D.id })
  await allowed(D.client.auth.getUser(), 'removed account still has valid native token')
  for (const table of tables) await hidden(D.client.from(table).select('*').eq(table === 'groups' ? 'id' : 'group_id', G), `removed member cannot read ${table}`)
  await denied(save(D, task, { title: 'Removed write' }), 'same valid token cannot write after removal')
  const current = await allowed(A.client.from('tasks').select('*').eq('id', task.id).single(), 'task revision after departure')
  task = { ...task, updated_at: current.updated_at }
  await denied(save(B, task, {}, { p_assignee_ids: [D.id] }), 'inactive assignee denied with current revision')
  await accept(D, inviteD.id)
  await hidden(D.client.from('groups').select('*').eq('id', G), 'old accepted invitation cannot reactivate departure')
  const removedChannel = D.client.channel(`northstar:group:${G}`, { config: { private: true } })
  check(await join(removedChannel) === 'CHANNEL_ERROR', 'removed member new subscription rejected')
  await rpc(B, 'revoke_group_invitation', { p_invitation_id: inviteC.id })
  check((await accept(C, inviteC.id)).status === 'revoked', 'revoked invitation terminal retry')
  await hidden(C.client.from('groups').select('*').eq('id', G), 'revoked recipient still has no membership')
  const assignments = await allowed(A.client.from('task_assignments').select('*').eq('task_id', task.id), 'assignments after departure')
  check(assignments.every((link) => link.assignee_user_id !== D.id), 'member removal clears assignments')

  await rpc(B, 'delete_task', { p_group_id: G, p_task_id: task.id, p_expected_updated_at: task.updated_at })
  for (const table of ['comments','task_activity','task_assignments','task_labels']) {
    await hidden(A.client.from(table).select('*').eq('task_id', task.id), `task deletion cascades ${table}`)
  }
  console.log('Guest access, nested relations, atomicity, ownership, invitations, history, cascades, and native Realtime passed.')
}
