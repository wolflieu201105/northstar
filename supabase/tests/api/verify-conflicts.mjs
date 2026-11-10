import { allowed, check } from './checks.mjs'

async function conflict(request, label) {
  const started = Date.now()
  const { error, status } = await request
  check(status === 409 && error?.code === 'PT409', `${label}: expected HTTP 409/PT409, received ${status}/${error?.code ?? 'success'}`)
  console.log(`${label}: HTTP 409/PT409 in ${Date.now() - started} ms`)
}

export async function verifyRevisionConflicts({ editor, reader, groupId, task, oldToken, label }) {
  const events = () => allowed(reader.from('task_activity').select('id').eq('task_id', task.id), 'read conflict event baseline')
  const before = await events()
  await conflict(editor.rpc('save_task', {
    p_group_id: groupId, p_task_id: task.id, p_changes: { title: 'Rejected stale edit' }, p_expected_updated_at: oldToken,
  }), 'Stale task edit')
  await conflict(editor.rpc('delete_task', {
    p_group_id: groupId, p_task_id: task.id, p_expected_updated_at: oldToken,
  }), 'Stale task deletion')
  await conflict(editor.rpc('save_label', {
    p_group_id: groupId, p_label_id: label.id, p_name: 'Rejected stale label', p_expected_updated_at: '2000-01-01T00:00:00Z',
  }), 'Stale label save')
  const currentTask = await allowed(reader.from('tasks').select('*').eq('id', task.id).single(), 'task readback after conflicts')
  const currentLabel = await allowed(reader.from('labels').select('*').eq('id', label.id).single(), 'label readback after conflicts')
  check(currentTask.title === task.title && currentTask.status === task.status && currentTask.updated_at === task.updated_at,
    'conflicts preserve the task and its exact revision')
  check(currentLabel.name === label.name && currentLabel.updated_at === label.updated_at,
    'conflict preserves the label and its exact revision')
  const after = await events()
  check(after.length === before.length && after.every((event) => before.some((item) => item.id === event.id)),
    'rejected revisions append no activity')
}
