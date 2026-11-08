import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Flag, LayoutDashboard, Trash2, X } from 'lucide-react'
import { toTaskInsert } from '../lib/taskUtils'
import {
  EMPTY_TASK_DRAFT,
  STATUS_META,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskDraft,
  type TaskInsert,
} from '../types/task'

interface TaskFormProps {
  task: Task | null
  defaultStatus: TaskDraft['status']
  opener: HTMLElement | null
  onSave: (input: TaskInsert) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function TaskForm({
  task,
  defaultStatus,
  opener,
  onSave,
  onDelete,
  onClose,
}: TaskFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          title: task.title,
          description: task.description ?? '',
          status: task.status,
          priority: task.priority,
          due_date: task.due_date ?? '',
        }
      : { ...EMPTY_TASK_DRAFT, status: defaultStatus },
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    titleInputRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const close = () => {
    onClose()
    window.requestAnimationFrame(() => opener?.focus())
  }

  const updateDraft = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!draft.title.trim()) {
      setError('Give this task a title before saving it.')
      titleInputRef.current?.focus()
      return
    }

    setIsSaving(true)
    try {
      await onSave(toTaskInsert(draft))
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The task could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (!onDelete || !window.confirm(`Delete “${task?.title}”? This cannot be undone.`)) return
    setIsDeleting(true)
    setError(null)
    try {
      await onDelete()
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The task could not be deleted.')
      setIsDeleting(false)
    }
  }

  const isBusy = isSaving || isDeleting

  return (
    <dialog
      ref={dialogRef}
      className="task-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!isBusy) close()
      }}
      aria-labelledby="task-dialog-title"
    >
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{task ? 'Task details' : 'New task'}</span>
            <h2 id="task-dialog-title">{task ? 'Refine the task' : 'What needs to get done?'}</h2>
          </div>
          <button
            className="icon-button dialog-close"
            type="button"
            onClick={close}
            disabled={isBusy}
            aria-label="Close task form"
          >
            <X size={20} />
          </button>
        </div>

        <div className="dialog-body">
          <label className="form-field" htmlFor={titleId}>
            <span>Task title</span>
            <input
              ref={titleInputRef}
              id={titleId}
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
              placeholder="e.g. Prepare the launch brief"
              maxLength={160}
              autoComplete="off"
            />
          </label>

          <label className="form-field" htmlFor={descriptionId}>
            <span>
              Description <small>Optional</small>
            </span>
            <textarea
              id={descriptionId}
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
              placeholder="Add context, links, or a clear definition of done."
              rows={4}
              maxLength={1000}
            />
          </label>

          <div className="form-grid">
            <label className="form-field select-field">
              <span>
                <LayoutDashboard size={15} aria-hidden="true" /> Status
              </span>
              <select
                value={draft.status}
                onChange={(event) =>
                  updateDraft('status', event.target.value as TaskDraft['status'])
                }
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_META[status].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field select-field">
              <span>
                <Flag size={15} aria-hidden="true" /> Priority
              </span>
              <select
                value={draft.priority}
                onChange={(event) =>
                  updateDraft('priority', event.target.value as TaskDraft['priority'])
                }
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority[0].toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field due-field">
              <span>
                <CalendarDays size={15} aria-hidden="true" /> Due date
              </span>
              <input
                type="date"
                value={draft.due_date}
                onChange={(event) => updateDraft('due_date', event.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <div>
            {task && onDelete && (
              <button
                className="button button-danger-ghost"
                type="button"
                onClick={() => void remove()}
                disabled={isBusy}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="dialog-footer-actions">
            <button className="button button-secondary" type="button" onClick={close} disabled={isBusy}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={isBusy}>
              {isSaving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
