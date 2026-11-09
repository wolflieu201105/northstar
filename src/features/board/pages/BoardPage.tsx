import { lazy, Suspense, useMemo } from 'react'
import { AlertCircle, CheckCircle2, CircleDotDashed, Clock3 } from 'lucide-react'
import type { useTasks } from '../../tasks/hooks/useTasks'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import { filterTasks, getBoardSummary } from '../../tasks/utils'
import type { Task, TaskPriority, TaskStatus } from '../../tasks/types'
import { BoardToolbar } from '../components/BoardToolbar'
import { BoardTeam } from '../../team/components/BoardTeam'
import { BoardSkeleton, EmptyBoardState } from '../components/BoardStates'

const Board = lazy(() => import('../components/Board').then((module) => ({ default: module.Board })))

interface BoardPageProps {
  taskState: ReturnType<typeof useTasks>
  workspace: ReturnType<typeof useWorkspaceData>
  filters: {
    query: string; priority: TaskPriority | 'all'
    setQuery: (query: string) => void; setPriority: (priority: TaskPriority | 'all') => void; clearFilters: () => void
  }
  isActive: boolean
  onCreate: (status?: TaskStatus) => void
  onOpenTask: (task: Task) => void
  onManageTeam: () => void
}

export function BoardPage({ taskState, workspace, filters, isActive, onCreate, onOpenTask, onManageTeam }: BoardPageProps) {
  const { tasks, isLoading, loadError, reload, movingTaskIds, moveTask } = taskState
  const { query, priority } = filters
  const filteredTasks = useMemo(() => filterTasks(tasks, query, priority), [tasks, query, priority])
  const summary = useMemo(() => getBoardSummary(tasks), [tasks])
  const hasFilters = Boolean(query.trim()) || priority !== 'all'
  return <>
    <section className="board-intro" aria-labelledby="board-title">
      <div><span className="eyebrow">My workspace</span>
        <h1 id="board-title" tabIndex={-1} data-view-active={isActive}>Shape the work. Ship with clarity.</h1>
        <p>Your focused view of what matters now, what needs attention, and what is done.</p></div>
      <div className="summary-cards" aria-label="Board summary">
        <div className="summary-card summary-total"><CircleDotDashed size={18} aria-hidden="true" /><span><strong>{summary.total}</strong> Total</span></div>
        <div className="summary-card summary-done"><CheckCircle2 size={18} aria-hidden="true" /><span><strong>{summary.completed}</strong> Completed</span></div>
        <div className="summary-card summary-overdue"><Clock3 size={18} aria-hidden="true" /><span><strong>{summary.overdue}</strong> Overdue</span></div>
      </div>
    </section>
    <BoardTeam members={workspace.members} isLoading={workspace.membersLoading} error={workspace.memberError}
      onRetry={workspace.reloadMembers} onManage={onManageTeam} />
    <section className="board-panel" aria-label="Project tasks">
      <div className="board-panel-header">
        <div className="board-panel-title"><h2>Project flow</h2>
          <span>{hasFilters ? `${filteredTasks.length} of ${tasks.length} tasks` : `${tasks.length} tasks`}</span></div>
        <BoardToolbar query={query} priority={priority} onQueryChange={filters.setQuery} onPriorityChange={filters.setPriority} onClear={filters.clearFilters} />
      </div>
      {loadError ? <div className="inline-error" role="alert"><AlertCircle size={20} />
        <div><strong>Tasks could not be loaded</strong><p>{loadError}</p></div>
        <button className="button button-secondary" type="button" onClick={reload}>Retry</button>
      </div> : isLoading ? <BoardSkeleton /> : tasks.length === 0 ? <EmptyBoardState onCreate={() => onCreate()} />
        : <Suspense fallback={<BoardSkeleton />}>
          <Board tasks={filteredTasks} allTasks={tasks} hasFilters={hasFilters} movingTaskIds={movingTaskIds}
            onCreate={onCreate} onEdit={onOpenTask} onMove={(taskId, status) => void moveTask(taskId, status)} />
        </Suspense>}
    </section>
  </>
}
