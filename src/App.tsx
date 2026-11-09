import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, CircleDotDashed, Clock3, Plus, X } from 'lucide-react'
import { AppHeader } from './components/AppHeader'
import { BoardToolbar } from './components/BoardToolbar'
import { BoardTeam } from './components/BoardTeam'
import {
  BoardSkeleton,
  ConfigurationState,
  EmptyBoardState,
  ErrorState,
  LoadingState,
} from './components/AppStates'
import { useGuestSession } from './hooks/useGuestSession'
import { useTasks } from './hooks/useTasks'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useWorkspaceNavigation } from './hooks/useWorkspaceNavigation'
import { filterTasks, getBoardSummary } from './lib/taskUtils'
import { supabase, supabaseConfigError } from './lib/supabase'
import type { WorkspaceView } from './state/navigationStore'
import type { Task, TaskStatus } from './types/task'

interface DialogState {
  location: string
  defaultStatus: TaskStatus
  opener: HTMLElement | null
}

const Board = lazy(() => import('./components/Board').then((module) => ({ default: module.Board })))
const TaskForm = lazy(() =>
  import('./components/TaskForm').then((module) => ({ default: module.TaskForm })),
)
const TaskDetailPanel = lazy(() => import('./components/TaskDetailPanel').then((module) => ({ default: module.TaskDetailPanel })))
const WorkspaceDirectoryPage = lazy(() => import('./pages/WorkspaceDirectoryPage').then((module) => ({ default: module.WorkspaceDirectoryPage })))
const TeamPage = lazy(() => import('./pages/TeamPage').then((module) => ({ default: module.TeamPage })))

function App() {
  const { session, isLoading: isSessionLoading, error: sessionError, retry: retrySession } =
    useGuestSession(supabase)
  const workspace = useWorkspaceData(supabase, session?.user.id)
  const {
    tasks,
    isLoading: areTasksLoading,
    loadError,
    reload,
    addTask,
    editTask,
    removeTask,
    moveTask,
    movingTaskIds,
    notice,
    dismissNotice,
  } = useTasks(supabase, session?.user.id, workspace)
  const navigation = useWorkspaceNavigation()
  const { query, priority } = navigation
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [detailOpener, setDetailOpener] = useState<HTMLElement | null>(null)
  const selectedTask = tasks.find((task) => task.id === navigation.taskId)

  const filteredTasks = useMemo(
    () => filterTasks(tasks, query, priority),
    [priority, query, tasks],
  )
  const summary = useMemo(() => getBoardSummary(tasks), [tasks])
  const hasFilters = Boolean(query.trim()) || priority !== 'all'

  const openCreate = (status: TaskStatus = 'todo') => {
    if (navigation.taskId) return
    setDialog({
      location: navigation.href,
      defaultStatus: status,
      opener: document.activeElement as HTMLElement | null,
    })
  }

  const openEdit = (task: Task) => {
    const opener = document.activeElement as HTMLElement | null
    if (navigation.openTask(task.id)) setDetailOpener(opener)
  }

  const visit = (view: WorkspaceView) => {
    if (navigation.visit(view)) window.requestAnimationFrame(() => {
      document.getElementById(view === 'board' ? 'board-title' : 'workspace-title')?.focus({ preventScroll: true })
    })
  }

  if (supabaseConfigError) return <ConfigurationState />
  if (isSessionLoading) return <LoadingState />
  if (sessionError || !session) {
    return (
      <ErrorState
        title="We couldn't start your guest session."
        message={sessionError ?? 'No active guest session was returned.'}
        onRetry={retrySession}
      />
    )
  }

  return (
    <div className="app-shell">
      <AppHeader guestId={session.user.id} view={navigation.view} onVisit={visit} onCreateTask={() => openCreate()} />

      <main id="main-content" className="main-content">
        <div hidden={navigation.view !== 'board'}>
        <section className="board-intro" aria-labelledby="board-title">
          <div>
            <span className="eyebrow">My workspace</span>
            <h1 id="board-title" tabIndex={-1} data-view-active={navigation.view === 'board'}>Shape the work. Ship with clarity.</h1>
            <p>Your focused view of what matters now, what needs attention, and what is done.</p>
          </div>

          <div className="summary-cards" aria-label="Board summary">
            <div className="summary-card summary-total">
              <CircleDotDashed size={18} aria-hidden="true" />
              <span><strong>{summary.total}</strong> Total</span>
            </div>
            <div className="summary-card summary-done">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span><strong>{summary.completed}</strong> Completed</span>
            </div>
            <div className="summary-card summary-overdue">
              <Clock3 size={18} aria-hidden="true" />
              <span><strong>{summary.overdue}</strong> Overdue</span>
            </div>
          </div>
        </section>

        <BoardTeam members={workspace.members} isLoading={workspace.membersLoading} error={workspace.memberError}
          onRetry={workspace.reloadMembers} onManage={() => visit('team')} />

        <section className="board-panel" aria-label="Project tasks">
          <div className="board-panel-header">
            <div className="board-panel-title">
              <h2>Project flow</h2>
              <span>{hasFilters ? `${filteredTasks.length} of ${tasks.length} tasks` : `${tasks.length} tasks`}</span>
            </div>
            <BoardToolbar
              query={query}
              priority={priority}
              onQueryChange={navigation.setQuery}
              onPriorityChange={navigation.setPriority}
              onClear={navigation.clearFilters}
            />
          </div>

          {loadError ? (
            <div className="inline-error" role="alert">
              <AlertCircle size={20} />
              <div><strong>Tasks could not be loaded</strong><p>{loadError}</p></div>
              <button className="button button-secondary" type="button" onClick={reload}>Retry</button>
            </div>
          ) : areTasksLoading ? (
            <BoardSkeleton />
          ) : tasks.length === 0 ? (
            <EmptyBoardState onCreate={() => openCreate()} />
          ) : (
            <Suspense fallback={<BoardSkeleton />}>
              <Board
                tasks={filteredTasks}
                allTasks={tasks}
                hasFilters={hasFilters}
                movingTaskIds={movingTaskIds}
                onCreate={openCreate}
                onEdit={openEdit}
                onMove={(taskId, status) => void moveTask(taskId, status)}
              />
            </Suspense>
          )}
        </section>
        </div>
        {navigation.view !== 'board' && <Suspense fallback={<p role="status">Loading workspace…</p>}>
          {navigation.view === 'team' ? <TeamPage key={session.user.id} workspace={workspace} tasks={tasks} tasksLoading={areTasksLoading}
            taskError={loadError} registerGuard={navigation.registerGuard} /> : <WorkspaceDirectoryPage view="labels" workspace={workspace} />}
        </Suspense>}
      </main>

      <button className="mobile-create" type="button" onClick={() => openCreate()}>
        <Plus size={20} /> <span>New task</span>
      </button>

      {notice && (
        <div className="toast" role="alert">
          <AlertCircle size={19} />
          <p>{notice.message}</p>
          {notice.retry && <button type="button" onClick={notice.retry}>Retry</button>}
          <button className="toast-close" type="button" onClick={dismissNotice} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}

      {dialog && dialog.location === navigation.href && !navigation.taskId && (
        <Suspense fallback={null}>
          <TaskForm
            key={session.user.id}
            task={null}
            defaultStatus={dialog.defaultStatus}
            opener={dialog.opener}
            onSave={async (input) => { await addTask(input) }}
            onClose={() => setDialog(null)}
            registerGuard={navigation.registerGuard}
            workspace={workspace}
            onManageTeam={navigation.view === 'team' ? undefined : () => visit('team')}
          />
        </Suspense>
      )}
      {navigation.taskId && <Suspense fallback={<p className="detail-loading-notice" role="status">Opening task details…</p>}>
        <TaskDetailPanel key={`${session.user.id}:${navigation.taskId}`} client={supabase} userId={session.user.id}
          task={selectedTask} isLoading={areTasksLoading} loadError={loadError}
          isTaskPending={movingTaskIds.has(navigation.taskId)} workspace={workspace} opener={detailOpener}
          registerGuard={navigation.registerGuard} onClose={navigation.closeTask} onDeleted={navigation.taskDeleted}
          onRetry={reload} onVisit={visit}
          onSave={(input, token) => editTask(navigation.taskId!, input, token)}
          onDelete={() => removeTask(navigation.taskId!)} />
      </Suspense>}
    </div>
  )
}

export default App
