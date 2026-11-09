import { CheckCircle2, CircleDotDashed, Clock3 } from 'lucide-react'
import { getBoardSummary } from '../../tasks/utils'
import type { Task } from '../../tasks/types'

export function BoardSummary({ tasks, today, isLoading, loadError }: { tasks: Task[]; today: Date; isLoading: boolean; loadError: string | null }) {
  const summary = getBoardSummary(tasks, today)
  const ready = !isLoading && !loadError
  return <div className="board-summary" role="group" aria-label="Whole-board summary" aria-busy={isLoading}>
    <p className="summary-scope">Whole board{isLoading ? ' · Loading…' : loadError ? ' · Counts unavailable' : ''}</p>
    <div className="summary-cards">
      <div className="summary-card summary-total"><CircleDotDashed size={18} aria-hidden="true" /><span><strong>{ready ? summary.total : '—'}</strong> Total</span></div>
      <div className="summary-card summary-done"><CheckCircle2 size={18} aria-hidden="true" /><span><strong>{ready ? summary.completed : '—'}</strong> Completed</span></div>
      <div className="summary-card summary-overdue"><Clock3 size={18} aria-hidden="true" /><span><strong>{ready ? summary.overdue : '—'}</strong> Overdue</span></div>
    </div>
  </div>
}
