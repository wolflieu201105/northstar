import { useEffect, useLayoutEffect, useRef } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import type { Task, TaskStatus, TaskView } from '../../tasks/types'
import { TASK_STATUSES } from '../../tasks/types'
import { BoardColumn } from './BoardColumn'

interface BoardProps {
  scrollPosition?: { left: number; top: number }
  onScroll?: (position: { left: number; top: number }) => void
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
  scrollPosition,
  onScroll,
  allTasks,
  today,
  hasFilters,
  movingTaskIds,
  onCreate,
  onEdit,
  onMove,
}: BoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialPosition = useRef(scrollPosition)
  const saveScroll = useRef(onScroll)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = initialPosition.current?.left ?? 0
    if (initialPosition.current) window.scrollTo(0, initialPosition.current.top)
  }, [])
  useEffect(() => { saveScroll.current = onScroll }, [onScroll])
  useEffect(() => {
    const save = () => saveScroll.current?.({ left: scrollRef.current?.scrollLeft ?? 0, top: window.scrollY })
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [])
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
      <div ref={scrollRef} className="board-scroll" aria-label="Task board" onScroll={(event) => onScroll?.({ left: event.currentTarget.scrollLeft, top: window.scrollY })}>
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
