import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/react'
import { STATUS_META, type Task, type TaskStatus, type TaskView } from '../../tasks/types'
import { TaskCard } from '../../tasks/components/TaskCard'

interface BoardColumnProps {
  status: TaskStatus
  tasks: TaskView[]
  totalCount: number
  hasFilters: boolean
  movingTaskIds: Set<string>
  onCreate: (status: TaskStatus) => void
  onEdit: (task: Task) => void
}

export function BoardColumn({
  status,
  tasks,
  totalCount,
  hasFilters,
  movingTaskIds,
  onCreate,
  onEdit,
}: BoardColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: `column:${status}`,
    type: 'column',
    accept: 'task',
    data: { status },
  })
  const meta = STATUS_META[status]

  return (
    <section
      ref={ref}
      className={`board-column column-${status}${isDropTarget ? ' is-drop-target' : ''}`}
      aria-labelledby={`column-${status}-title`}
    >
      <header className="column-header">
        <div className="column-title-row">
          <span className="column-status-mark" aria-hidden="true" />
          <h2 id={`column-${status}-title`}>{meta.label}</h2>
          <span className="column-count" aria-label={`${tasks.length} visible tasks`}>
            {hasFilters && tasks.length !== totalCount ? `${tasks.length}/${totalCount}` : totalCount}
          </span>
        </div>
        <p>{meta.description}</p>
      </header>

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isMoving={movingTaskIds.has(task.id)}
            onEdit={onEdit}
          />
        ))}

        {tasks.length === 0 && (
          <div className="column-empty">
            <span className="empty-orbit" aria-hidden="true" />
            <p>{hasFilters && totalCount > 0 ? 'No matching tasks here' : 'This lane is ready'}</p>
            <small>
              {hasFilters && totalCount > 0
                ? 'Try adjusting your filters.'
                : `Move a task here or add one.`}
            </small>
          </div>
        )}
      </div>

      <button className="column-add" type="button" onClick={() => onCreate(status)}>
        <Plus size={16} />
        Add task
      </button>
    </section>
  )
}
