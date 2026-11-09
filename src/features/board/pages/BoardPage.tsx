import { lazy, Suspense, useLayoutEffect, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { useTasks } from '../../tasks/hooks/useTasks'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import { filterTasks } from '../../tasks/utils'
import type { Task, TaskStatus } from '../../tasks/types'
import { BoardToolbar } from '../components/BoardToolbar'
import { BoardTeam } from '../../team/components/BoardTeam'
import { BoardSkeleton, EmptyBoardState } from '../components/BoardStates'
import { BoardSummary } from '../components/BoardSummary'
import type { BoardFilters } from '../filters/types'
import { useBoardFilters } from '../hooks/useBoardFilters'
import { useBoardDate } from '../hooks/useBoardDate'

const Board = lazy(() => import('../components/Board').then((module) => ({ default: module.Board })))

interface BoardPageProps {
  taskState: ReturnType<typeof useTasks>
  workspace: ReturnType<typeof useWorkspaceData>
  filters: BoardFilters
  isActive: boolean
  groupName?: string
  scrollPosition?: { left: number; top: number }
  onScroll?: (position: { left: number; top: number }) => void
  onRefresh?: () => void
  onCreate: (status?: TaskStatus) => void
  onOpenTask: (task: Task) => void
  onManageTeam: () => void
}

export function BoardPage({ taskState, workspace, filters, isActive, onCreate, onOpenTask, onManageTeam, groupName, scrollPosition, onScroll, onRefresh }: BoardPageProps) {
  const { tasks, isLoading, loadError, reload, movingTaskIds, moveTask } = taskState
  const { query, priority } = filters
  const { members, labels, assignee, label, hasFilters } = useBoardFilters(filters, taskState, workspace)
  const today = useBoardDate()
  useLayoutEffect(() => { if (isActive && scrollPosition) window.scrollTo(0, scrollPosition.top) }, [isActive, scrollPosition])
  const filteredTasks = useMemo(() => filterTasks(tasks, query, priority, { assignee, label }), [tasks, query, priority, assignee, label])
  return <>
    <section className="board-intro" aria-labelledby="board-title">
      <div><span className="eyebrow">{groupName ?? "Active group"}</span>
        <h1 id="board-title" tabIndex={-1} data-view-active={isActive}>Shape the work. Ship with clarity.</h1>
        <p>Your focused view of what matters now, what needs attention, and what is done.</p></div>
      <BoardSummary tasks={tasks} today={today} isLoading={isLoading} loadError={loadError} />
    </section>
    <BoardTeam members={workspace.members} isLoading={workspace.membersLoading} error={workspace.memberError}
      onRetry={workspace.reloadMembers} onManage={onManageTeam} />
    <section className="board-panel" aria-label="Project tasks">
      <div className="board-panel-header">
        <div className="board-panel-title"><h2>Project flow</h2>{onRefresh && <button className="text-button" onClick={onRefresh} disabled={isLoading}>Refresh group</button>}
          <span aria-live="polite">{isLoading ? 'Loading tasks…' : loadError ? 'Task counts unavailable' : `Showing ${filteredTasks.length} of ${tasks.length} tasks`}</span></div>
        <BoardToolbar filters={{ ...filters, assignee, label }} members={members} labels={labels} workspace={workspace} />
      </div>
      {!isLoading && !loadError && tasks.length > 0 && filteredTasks.length === 0 && <p className="board-no-matches" role="status">No tasks match these filters. Adjust a filter or use Clear filters above.</p>}
      {loadError ? <div className="inline-error" role="alert"><AlertCircle size={20} />
        <div><strong>Tasks could not be loaded</strong><p>{loadError}</p></div>
        <button className="button button-secondary" type="button" onClick={reload}>Retry</button>
      </div> : isLoading ? <BoardSkeleton /> : tasks.length === 0 ? <EmptyBoardState onCreate={() => onCreate()} />
        : <Suspense fallback={<BoardSkeleton />}>
          <Board scrollPosition={scrollPosition} onScroll={isActive ? onScroll : undefined} tasks={filteredTasks} allTasks={tasks} today={today} hasFilters={hasFilters} movingTaskIds={movingTaskIds}
            onCreate={onCreate} onEdit={onOpenTask} onMove={(taskId, status) => void moveTask(taskId, status)} />
        </Suspense>}
    </section>
  </>
}
