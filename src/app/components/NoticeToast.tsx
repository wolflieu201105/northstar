import { AlertCircle, X } from 'lucide-react'
import type { useTasks } from '../../features/tasks/hooks/useTasks'

interface NoticeToastProps {
  notice: NonNullable<ReturnType<typeof useTasks>['notice']>
  onDismiss: () => void
}

export function NoticeToast({ notice, onDismiss }: NoticeToastProps) {
  return <div className="toast" role="alert">
    <AlertCircle size={19} />
    <p>{notice.message}</p>
    {notice.retry && <button type="button" onClick={notice.retry}>Retry</button>}
    <button className="toast-close" type="button" onClick={onDismiss} aria-label="Dismiss message"><X size={16} /></button>
  </div>
}
