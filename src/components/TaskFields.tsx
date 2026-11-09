import { useId, type Ref } from 'react'
import { CalendarDays, Flag, LayoutDashboard } from 'lucide-react'
import { STATUS_META, TASK_PRIORITIES, TASK_STATUSES, type TaskDraft } from '../types/task'

interface TaskFieldsProps {
  draft: TaskDraft
  onChange: (draft: TaskDraft) => void
  titleRef?: Ref<HTMLInputElement>
}

export function TaskFields({ draft, onChange, titleRef }: TaskFieldsProps) {
  const titleId = useId()
  const descriptionId = useId()
  const update = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => onChange({ ...draft, [key]: value })
  return <>
    <label className="form-field" htmlFor={titleId}>
      <span>Task title</span>
      <input ref={titleRef} data-initial-focus id={titleId} value={draft.title}
        onChange={(event) => update('title', event.target.value)}
        placeholder="e.g. Prepare the launch brief" maxLength={160} autoComplete="off" />
    </label>
    <label className="form-field" htmlFor={descriptionId}>
      <span>Description <small>Optional</small></span>
      <textarea id={descriptionId} value={draft.description} onChange={(event) => update('description', event.target.value)}
        placeholder="Add context, links, or a clear definition of done." rows={4} maxLength={1000} />
    </label>
    <div className="form-grid">
      <label className="form-field select-field">
        <span><LayoutDashboard size={15} aria-hidden="true" /> Status</span>
        <select value={draft.status} onChange={(event) => update('status', event.target.value as TaskDraft['status'])}>
          {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
        </select>
      </label>
      <label className="form-field select-field">
        <span><Flag size={15} aria-hidden="true" /> Priority</span>
        <select value={draft.priority} onChange={(event) => update('priority', event.target.value as TaskDraft['priority'])}>
          {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
        </select>
      </label>
      <label className="form-field due-field">
        <span><CalendarDays size={15} aria-hidden="true" /> Due date</span>
        <input type="date" value={draft.due_date} onChange={(event) => update('due_date', event.target.value)} />
      </label>
    </div>
  </>
}
