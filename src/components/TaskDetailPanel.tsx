import { useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { AppClient } from '../lib/supabase'
import { toTaskInsert } from '../lib/taskUtils'
import { useDraftProtection, type RegisterNavigationGuard } from '../hooks/useDraftProtection'
import { useModalDialog } from '../hooks/useModalDialog'
import { useTaskDetails } from '../hooks/useTaskDetails'
import type { useWorkspaceData } from '../hooks/useWorkspaceData'
import type { TaskDraft, TaskInsert, TaskView } from '../types/task'
import type { WorkspaceView } from '../state/navigationStore'
import { TaskFields } from './TaskFields'
import { TaskDiscussion } from './TaskDiscussion'
import { TaskRelationPicker } from './TaskRelationPicker'
import { AssigneePicker } from './AssigneePicker'

type Workspace = ReturnType<typeof useWorkspaceData>
type Details = ReturnType<typeof useTaskDetails>
interface TaskDetailPanelProps {
  client: AppClient | null
  userId: string
  task: TaskView | undefined
  isLoading: boolean
  loadError: string | null
  isTaskPending: boolean
  workspace: Workspace
  opener: HTMLElement | null
  registerGuard: RegisterNavigationGuard
  onClose: () => void
  onDeleted: () => void
  onRetry: () => void
  onVisit: (view: WorkspaceView) => void
  onSave: (input: TaskInsert, expectedUpdatedAt: string) => Promise<TaskView>
  onDelete: () => Promise<void>
}

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const dialogRef = useModalDialog(props.opener)
  const details = useTaskDetails(props.client, props.userId, props.task?.id ?? null, props.task?.updated_at)
  const busy = props.isTaskPending || details.isPosting
  return <dialog ref={dialogRef} className="task-dialog task-detail-panel" aria-labelledby="task-detail-title"
    onCancel={(event) => { event.preventDefault(); props.onClose() }}>
    <div className="dialog-header detail-header">
      <div><span className="eyebrow">My workspace / Task details</span><h2 id="task-detail-title">{props.task?.title ?? 'Task details'}</h2></div>
      <button data-initial-focus className="icon-button dialog-close" type="button" onClick={props.onClose} disabled={busy} aria-label="Close task details"><X size={20} /></button>
    </div>
    {props.task ? <TaskDetailEditor key={props.task.id} {...props} task={props.task} details={details} /> : <div className="detail-unavailable">
      {props.isLoading ? <p role="status">Loading task…</p> : props.loadError ? <>
        <h3>Task could not be loaded</h3><p role="alert">{props.loadError}</p>
        <button className="button button-secondary" type="button" onClick={props.onRetry}>Retry</button>
      </> : <><h3>This task is unavailable</h3><p>It may have been deleted or belong to another workspace.</p></>}
      <button className="button button-secondary" type="button" onClick={props.onClose}>Return to board</button>
    </div>}
  </dialog>
}

function editState(task: TaskView) {
  const draft: TaskDraft = { title: task.title, description: task.description ?? '', status: task.status, priority: task.priority, due_date: task.due_date ?? '' }
  return { baseline: task, draft, assigneeIds: task.assignees.map((member) => member.id), labelIds: task.labels.map((label) => label.id) }
}
function sameIds(left: string[], right: string[]) { return left.length === right.length && left.every((id) => right.includes(id)) }

function TaskDetailEditor({ task, details, workspace, isTaskPending, registerGuard, onSave, onDelete, onDeleted, onVisit }: TaskDetailPanelProps & { task: TaskView; details: Details }) {
  const [edit, setEdit] = useState(() => editState(task))
  const [observedTask, setObservedTask] = useState(task)
  const [pending, setPending] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const mutationPending = useRef(false)
  const original = editState(edit.baseline)
  const dirty = JSON.stringify(edit.draft) !== JSON.stringify(original.draft)
    || !sameIds(edit.assigneeIds, original.assigneeIds) || !sameIds(edit.labelIds, original.labelIds)
  const busy = pending !== null || isTaskPending || details.isPosting
  const conflict = edit.baseline.updated_at !== task.updated_at

  // Adopt external changes only while clean; preserve a dirty draft and its exact edit token.
  if (observedTask !== task) {
    setObservedTask(task)
    if (!dirty && pending === null) setEdit(editState(task))
  }
  useDraftProtection(dirty || details.commentDraft.length > 0, busy, registerGuard)
  const labels = [...new Map([...workspace.labels.filter((row) => !row.archived_at), ...task.labels].map((row) => [row.id, row])).values()]

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || mutationPending.current || conflict) return
    if (!edit.draft.title.trim()) { setError('Give this task a title before saving it.'); titleRef.current?.focus(); return }
    mutationPending.current = true
    setPending('save'); setError(null); setSavedMessage('')
    try {
      const saved = await onSave({ ...toTaskInsert(edit.draft), assigneeIds: edit.assigneeIds, labelIds: edit.labelIds }, edit.baseline.updated_at)
      setEdit(editState(saved)); setSavedMessage('Changes saved.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The task could not be saved.') }
    finally { mutationPending.current = false; setPending(null) }
  }
  const remove = async () => {
    if (busy || mutationPending.current || !window.confirm(`Delete “${task.title}” and its comments and history? This cannot be undone.`)) return
    mutationPending.current = true
    setPending('delete'); setError(null)
    try { await onDelete(); onDeleted() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The task could not be deleted.') }
    finally { mutationPending.current = false; setPending(null) }
  }
  const useLatest = () => {
    if (dirty && !window.confirm('Replace your task edits with the latest saved version? Your comment draft will stay.')) return
    setEdit(editState(task)); setError(null); setSavedMessage('Latest saved task loaded.')
  }
  return <>
    <form className="detail-metadata" aria-label="Edit task" onSubmit={(event) => void save(event)} aria-busy={pending !== null}>
      <fieldset className="dialog-body form-fields" disabled={busy}>
        {conflict && <div className="form-error" role="alert"><p>The saved task changed. Your edits are still here. Review the latest version before saving.</p>
          <button className="text-button" type="button" onClick={useLatest}>Use latest saved task</button></div>}
        <TaskFields draft={edit.draft} titleRef={titleRef} onChange={(draft) => { setEdit((current) => ({ ...current, draft })); setSavedMessage('') }} />
        <AssigneePicker members={workspace.members} assignedMembers={task.assignees}
          selectedIds={edit.assigneeIds} isLoading={workspace.membersLoading} error={workspace.memberError}
          onChange={(assigneeIds) => { setEdit((current) => ({ ...current, assigneeIds })); setSavedMessage('') }}
          onRetry={workspace.reloadMembers} onManage={() => onVisit('team')} />
        <TaskRelationPicker title="Labels" options={labels} selectedIds={edit.labelIds} isLoading={workspace.labelsLoading} error={workspace.labelError}
          onChange={(labelIds) => { setEdit((current) => ({ ...current, labelIds })); setSavedMessage('') }}
          onRetry={workspace.reloadLabels} onManage={() => onVisit('labels')} />
        {error && <div className="form-error" role="alert">{error}</div>}
      </fieldset>
      <div className="dialog-footer detail-save-bar">
        <button className="button button-danger-ghost" type="button" onClick={() => void remove()} disabled={busy}>
          <Trash2 size={16} />{pending === 'delete' ? 'Deleting…' : 'Delete task'}</button>
        <div className="dialog-footer-actions">
          <span className="save-message" role="status">{pending === 'save' ? 'Saving…' : savedMessage || (dirty ? 'Unsaved changes' : '')}</span>
          <button className="button button-primary" type="submit" disabled={busy || !dirty || conflict}>{pending === 'save' ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </form>
    <TaskDiscussion details={details} disabled={pending === 'delete' || isTaskPending} />
  </>
}
