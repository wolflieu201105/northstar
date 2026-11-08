import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, CircleDotDashed, Clock3, Plus, X } from 'lucide-react'
import { AppHeader } from './components/AppHeader'
import { BoardToolbar } from './components/BoardToolbar'
import {
  BoardSkeleton,
  ConfigurationState,
  EmptyBoardState,
  ErrorState,
  LoadingState,
} from './components/AppStates'
import { useGuestSession } from './hooks/useGuestSession'
import { useTasks } from './hooks/useTasks'
import { filterTasks, getBoardSummary } from './lib/taskUtils'
import { supabase, supabaseConfigError } from './lib/supabase'
import type { Task, TaskPriority, TaskStatus } from './types/task'

interface DialogState {
  task: Task | null
  defaultStatus: TaskStatus
  opener: HTMLElement | null
}

const Board = lazy(() => import('./components/Board').then((module) => ({ default: module.Board })))
const TaskForm = lazy(() =>
  import('./components/TaskForm').then((module) => ({ default: module.TaskForm })),
)

function App() {
  const { session, isLoading: isSessionLoading, error: sessionError, retry: retrySession } =
    useGuestSession(supabase)
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
  } = useTasks(supabase, session?.user.id)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all')
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const filteredTasks = useMemo(
    () => filterTasks(tasks, query, priority),
    [priority, query, tasks],
  )
  const summary = useMemo(() => getBoardSummary(tasks), [tasks])
  const hasFilters = Boolean(query.trim()) || priority !== 'all'

  const openCreate = (status: TaskStatus = 'todo') => {
    setDialog({
      task: null,
      defaultStatus: status,
      opener: document.activeElement as HTMLElement | null,
    })
  }

  const openEdit = (task: Task) => {
    setDialog({
      task,
      defaultStatus: task.status,
      opener: document.activeElement as HTMLElement | null,
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
      <AppHeader guestId={session.user.id} onCreateTask={() => openCreate()} />

      <main id="main-content" className="main-content">
        <section className="board-intro" aria-labelledby="board-title">
          <div>
            <span className="eyebrow">My workspace</span>
            <h1 id="board-title">Shape the work. Ship with clarity.</h1>
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

        <section className="board-panel" aria-label="Project tasks">
          <div className="board-panel-header">
            <div className="board-panel-title">
              <h2>Project flow</h2>
              <span>{hasFilters ? `${filteredTasks.length} of ${tasks.length} tasks` : `${tasks.length} tasks`}</span>
            </div>
            <BoardToolbar
              query={query}
              priority={priority}
              onQueryChange={setQuery}
              onPriorityChange={setPriority}
              onClear={() => {
                setQuery('')
                setPriority('all')
              }}
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

      {dialog && (
        <Suspense fallback={null}>
          <TaskForm
            task={dialog.task}
            defaultStatus={dialog.defaultStatus}
            opener={dialog.opener}
            onSave={async (input) => {
              if (dialog.task) await editTask(dialog.task.id, input)
              else await addTask(input)
            }}
            onDelete={dialog.task ? () => removeTask(dialog.task!.id) : undefined}
            onClose={() => setDialog(null)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default App
