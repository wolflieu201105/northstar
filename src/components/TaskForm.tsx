import { useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useDraftProtection, type RegisterNavigationGuard } from '../hooks/useDraftProtection'
import { useModalDialog } from '../hooks/useModalDialog'
import { toTaskInsert } from '../lib/taskUtils'
import { EMPTY_TASK_DRAFT, type TaskView, type TaskDraft, type TaskInsert } from '../types/task'
import type { useWorkspaceData } from '../hooks/useWorkspaceData'
import { TaskFields } from './TaskFields'
import { AssigneePicker } from './AssigneePicker'

interface TaskFormProps {
  task: TaskView | null
  defaultStatus: TaskDraft['status']
  opener: HTMLElement | null
  onSave: (input: TaskInsert) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
  registerGuard?: RegisterNavigationGuard
  workspace?: Pick<ReturnType<typeof useWorkspaceData>, 'members' | 'membersLoading' | 'memberError' | 'reloadMembers'>
  onManageTeam?: () => void
}

export function TaskForm({ task, defaultStatus, opener, onSave, onDelete, onClose, registerGuard, workspace, onManageTeam }: TaskFormProps) {
  const dialogRef = useModalDialog(opener)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [initialDraft] = useState<TaskDraft>(() => task ? {
    title: task.title, description: task.description ?? '', status: task.status,
    priority: task.priority, due_date: task.due_date ?? '',
  } : { ...EMPTY_TASK_DRAFT, status: defaultStatus })
  const [draft, setDraft] = useState(initialDraft)
  const [initialAssigneeIds] = useState(() => task?.assignees.map((member) => member.id) ?? [])
  const [assigneeIds, setAssigneeIds] = useState(initialAssigneeIds)
  const [pending, setPending] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(initialDraft) !== JSON.stringify(draft)
    || initialAssigneeIds.length !== assigneeIds.length || initialAssigneeIds.some((id) => !assigneeIds.includes(id))
  const canLeave = useDraftProtection(dirty, pending !== null, registerGuard, onClose)
  const close = () => { if (canLeave()) onClose() }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy.current) return
    setError(null)
    if (!draft.title.trim()) {
      setError('Give this task a title before saving it.')
      titleInputRef.current?.focus()
      return
    }
    busy.current = true
    setPending('save')
    try { await onSave({ ...toTaskInsert(draft), ...(workspace ? { assigneeIds } : {}) }); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The task could not be saved.') }
    finally { busy.current = false; setPending(null) }
  }
  const remove = async () => {
    if (!onDelete || busy.current || !window.confirm(`Delete “${task?.title}”? This cannot be undone.`)) return
    busy.current = true
    setPending('delete')
    setError(null)
    try { await onDelete(); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The task could not be deleted.') }
    finally { busy.current = false; setPending(null) }
  }

  return <dialog ref={dialogRef} className="task-dialog" aria-labelledby="task-dialog-title"
    onCancel={(event) => { event.preventDefault(); close() }}>
    <form onSubmit={(event) => void submit(event)} aria-busy={pending !== null}>
      <div className="dialog-header">
        <div><span className="eyebrow">{task ? 'Task details' : 'New task'}</span>
          <h2 id="task-dialog-title">{task ? 'Refine the task' : 'What needs to get done?'}</h2></div>
        <button className="icon-button dialog-close" type="button" onClick={close} disabled={pending !== null} aria-label="Close task form"><X size={20} /></button>
      </div>
      <fieldset className="dialog-body form-fields" disabled={pending !== null}>
        <TaskFields draft={draft} onChange={setDraft} titleRef={titleInputRef} />
        {workspace && <AssigneePicker members={workspace.members} assignedMembers={task?.assignees}
          selectedIds={assigneeIds} isLoading={workspace.membersLoading} error={workspace.memberError}
          onChange={setAssigneeIds} onRetry={workspace.reloadMembers} onManage={onManageTeam} />}
        {error && <div className="form-error" role="alert">{error}</div>}
      </fieldset>
      <div className="dialog-footer">
        <div>{task && onDelete && <button className="button button-danger-ghost" type="button" onClick={() => void remove()} disabled={pending !== null}>
          <Trash2 size={16} />{pending === 'delete' ? 'Deleting…' : 'Delete'}
        </button>}</div>
        <div className="dialog-footer-actions">
          <button className="button button-secondary" type="button" onClick={close} disabled={pending !== null}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={pending !== null}>{pending === 'save' ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
        </div>
      </div>
    </form>
  </dialog>
}
