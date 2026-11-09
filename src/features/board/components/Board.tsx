import { DragDropProvider } from '@dnd-kit/react'
import type { Task, TaskStatus, TaskView } from '../../tasks/types'
import { TASK_STATUSES } from '../../tasks/types'
import { BoardColumn } from './BoardColumn'

interface BoardProps {
  tasks: TaskView[]
  allTasks: TaskView[]
  today: Date
  hasFilters: boolean
  movingTaskIds: Set<string>
  onCreate: (status: TaskStatus) => void
  onEdit: (task: Task) => void
  onMove: (taskId: string, status: TaskStatus) => void
}

export function Board({
  tasks,
  allTasks,
  today,
  hasFilters,
  movingTaskIds,
  onCreate,
  onEdit,
  onMove,
}: BoardProps) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return
        const sourceData = event.operation.source?.data as { taskId?: string } | undefined
        const targetData = event.operation.target?.data as { status?: TaskStatus } | undefined
        if (sourceData?.taskId && targetData?.status) {
          onMove(sourceData.taskId, targetData.status)
        }
      }}
    >
      <div className="board-scroll" aria-label="Task board">
        <div className="board-grid">
          {TASK_STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={tasks.filter((task) => task.status === status)}
              totalCount={allTasks.filter((task) => task.status === status).length}
              today={today}
              hasFilters={hasFilters}
              movingTaskIds={movingTaskIds}
              onCreate={onCreate}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  )
}
