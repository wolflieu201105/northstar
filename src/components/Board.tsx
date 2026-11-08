import { DragDropProvider } from '@dnd-kit/react'
import type { Task, TaskStatus } from '../types/task'
import { TASK_STATUSES } from '../types/task'
import { BoardColumn } from './BoardColumn'

interface BoardProps {
  tasks: Task[]
  allTasks: Task[]
  hasFilters: boolean
  movingTaskIds: Set<string>
  onCreate: (status: TaskStatus) => void
  onEdit: (task: Task) => void
  onMove: (taskId: string, status: TaskStatus) => void
}

export function Board({
  tasks,
  allTasks,
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
