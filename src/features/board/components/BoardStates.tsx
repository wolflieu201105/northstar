import { ArrowRight } from 'lucide-react'

export function EmptyBoardState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-board">
      <div className="empty-board-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <span className="eyebrow">A clean slate</span>
        <h2>Turn the first idea into momentum.</h2>
        <p>Create a task, give it a priority, then move it across the board as work progresses.</p>
      </div>
      <button className="button button-primary" type="button" onClick={onCreate}>
        Create your first task <ArrowRight size={17} />
      </button>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="board-grid skeleton-grid" aria-label="Loading tasks" aria-busy="true">
      {[0, 1, 2, 3].map((column) => (
        <div className="skeleton-column" key={column}>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-subtitle" />
          {[0, 1].map((card) => (
            <div className="skeleton-card" key={card}>
              <span className="skeleton skeleton-chip" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
