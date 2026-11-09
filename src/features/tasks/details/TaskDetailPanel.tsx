import { X } from 'lucide-react'
import { useModalDialog } from '../../../shared/hooks/useModalDialog'
import { useTaskDetails } from '../hooks/useTaskDetails'
import { TaskDetailEditor } from './TaskDetailEditor'
import type { TaskDetailPanelProps } from './types'

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const dialogRef = useModalDialog(props.opener)
  const details = useTaskDetails(props.client, props.userId, props.task?.id ?? null, props.task?.updated_at, props.groupId, props.onAccessError)
  const busy = props.isTaskPending || details.isPosting
  return <dialog ref={dialogRef} className="task-dialog task-detail-panel" aria-labelledby="task-detail-title"
    onCancel={(event) => { event.preventDefault(); props.onClose() }}>
    <div className="dialog-header detail-header">
      <div><span className="eyebrow">Group / Task details</span><h2 id="task-detail-title">{props.task?.title ?? 'Task details'}</h2></div>
      <button data-initial-focus className="icon-button dialog-close" type="button" onClick={props.onClose} disabled={busy} aria-label="Close task details"><X size={20} /></button>
    </div>
    {props.task ? <TaskDetailEditor key={props.task.id} {...props} task={props.task} details={details} /> : <div className="detail-unavailable">
      {props.isLoading ? <p role="status">Loading task…</p> : props.loadError ? <>
        <h3>Task could not be loaded</h3><p role="alert">{props.loadError}</p>
        <button className="button button-secondary" type="button" onClick={props.onRetry}>Retry</button>
      </> : <><h3>This task is unavailable</h3><p>It may have been deleted or belong to another group.</p></>}
      <button className="button button-secondary" type="button" onClick={props.onClose}>Return to board</button>
    </div>}
  </dialog>
}
