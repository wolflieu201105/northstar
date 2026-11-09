import { CalendarDays, GripVertical, Pencil } from 'lucide-react'
import { useDraggable } from '@dnd-kit/react'
import { formatDueDate, getDueState } from '../lib/taskUtils'
import type { Task, TaskView } from '../types/task'
import { MemberAvatarStack } from './MemberAvatar'

interface TaskCardProps {
  task: TaskView
  isMoving: boolean
  onEdit: (task: Task) => void
}

const dueLabels = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Due soon',
  later: 'Due',
}

export function TaskCard({ task, isMoving, onEdit }: TaskCardProps) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    type: 'task',
    data: { taskId: task.id },
    disabled: isMoving,
  })
  const dueState = getDueState(task.due_date, task.status)

  return (
    <article
      ref={ref}
      className={`task-card${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-saving' : ''}`}
      aria-busy={isMoving}
    >
      <div className="task-card-topline">
        <span className={`priority-badge priority-${task.priority}`}>
          <span aria-hidden="true" />
          {task.priority}
        </span>
        <div className="card-actions">
          <button
            className="icon-button card-edit"
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Open details for ${task.title}`}
          >
            <Pencil size={15} />
          </button>
          <button
            ref={handleRef}
            className="icon-button drag-handle"
            type="button"
            aria-label={`Drag ${task.title}`}
            disabled={isMoving}
          >
            <GripVertical size={17} />
          </button>
        </div>
      </div>

      <h3><button className="task-title-button" type="button" onClick={() => onEdit(task)}>{task.title}</button></h3>
      {task.description && <p className="task-description">{task.description}</p>}

      <div className="task-card-footer">
        {task.due_date && dueState ? (
          <span className={`due-date due-${dueState}`}>
            <CalendarDays size={14} aria-hidden="true" />
            <span>
              {dueLabels[dueState]} · {formatDueDate(task.due_date)}
            </span>
          </span>
        ) : (
          <span className="no-due-date">No due date</span>
        )}
        {isMoving && <span className="saving-label">Saving…</span>}
      </div>
      <div className="task-assignees">
        {task.assignees.length > 0 ? <>
          <MemberAvatarStack members={task.assignees} />
          {task.assignees.some((member) => member.archived_at) && <span className="archived-assignee-note">Includes archived</span>}
        </> : <span className="unassigned-label">Unassigned</span>}
      </div>
    </article>
  )
}
