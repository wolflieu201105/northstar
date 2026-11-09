import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw, Tags } from 'lucide-react'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import type { TaskView } from '../../tasks/types'
import type { Label } from '../types'
import { LabelChip } from '../components/LabelChip'
import { LabelForm } from '../components/LabelForm'

interface LabelsPageProps {
  workspace: ReturnType<typeof useWorkspaceData>
  tasks: TaskView[]
  tasksLoading: boolean
  taskError: string | null
  registerGuard: RegisterNavigationGuard
}
interface EditorState { label: Label | null; opener: HTMLElement | null }

export function LabelsPage({ workspace, tasks, tasksLoading, taskError, registerGuard }: LabelsPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const archivePending = useRef(false)
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [])
  useDraftProtection(false, pendingId !== null, registerGuard)
  const active = workspace.labels.filter((label) => !label.archived_at)
  const archived = workspace.labels.filter((label) => label.archived_at)
  const visible = (filter === 'active' ? active : archived).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) for (const label of task.labels) counts.set(label.id, (counts.get(label.id) ?? 0) + 1)
    return counts
  }, [tasks])
  const locked = editor !== null || pendingId !== null
  const openEditor = (label: Label | null) => {
    if (locked) return
    setError(null); setMessage('')
    setEditor({ label, opener: document.activeElement as HTMLElement | null })
    if (!label) setFilter('active')
  }
  const setArchived = async (label: Label) => {
    if (locked || archivePending.current) return
    const archive = !label.archived_at
    archivePending.current = true; setPendingId(label.id); setError(null); setMessage('')
    try {
      await workspace.setLabelArchived(label.id, archive, label.updated_at)
      setMessage(`${label.name} ${archive ? 'archived. Existing task labels are retained.' : 'restored and available for tagging.'}`)
      window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The label could not be updated.') }
    finally { archivePending.current = false; setPendingId(null) }
  }
  return <section className="workspace-directory labels-page" aria-labelledby="workspace-title">
    <div className="directory-intro team-page-intro"><div><span className="eyebrow">Active group</span>
      <h1 ref={headingRef} id="workspace-title" tabIndex={-1} data-view-active="true">Labels</h1>
      <p>Group related work with labels that belong to this group.</p></div>
      <button className="button button-primary" type="button" disabled={locked} onClick={() => openEditor(null)}><Plus size={17} />Add label</button>
    </div>
    {editor && <LabelForm key={editor.label ? `${editor.label.id}:${editor.label.updated_at}` : 'new-label'} label={editor.label} labels={workspace.labels}
      opener={editor.opener} registerGuard={registerGuard} onClose={() => setEditor(null)}
      onReloadLabels={workspace.reloadLabels} onUseLatest={(label) => setEditor({ label, opener: editor.opener })}
      onSave={async (draft) => {
        const saved = editor.label ? await workspace.editLabel(editor.label.id, draft, editor.label.updated_at) : await workspace.addLabel(draft)
        setMessage(`${saved.name} ${editor.label ? 'updated' : 'added to your labels'}.`)
      }} onRestore={async (label) => {
        const saved = await workspace.setLabelArchived(label.id, false, label.updated_at)
        setFilter('active'); setMessage(`${saved.name} restored with its saved name, color, and task links.`)
      }} />}
    <p className="team-action-message" role="status" aria-live="polite">{message}</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="directory-panel">
      <div className="directory-panel-heading"><Tags size={20} aria-hidden="true" /><h2>Workspace labels</h2></div>
      <div className="directory-filters" role="group" aria-label="Label status">
        <button type="button" aria-pressed={filter === 'active'} disabled={locked} onClick={() => setFilter('active')}>Active{!workspace.labelsLoading && !workspace.labelError ? ` (${active.length})` : ''}</button>
        <button type="button" aria-pressed={filter === 'archived'} disabled={locked} onClick={() => setFilter('archived')}>Archived{!workspace.labelsLoading && !workspace.labelError ? ` (${archived.length})` : ''}</button>
      </div>
      {workspace.labelsLoading && <p className="directory-message" role="status">Loading labels…</p>}
      {workspace.labelError && <div className="inline-error" role="alert"><p>{workspace.labelError}</p>
        <button className="button button-secondary" type="button" disabled={pendingId !== null || workspace.labelsLoading} onClick={workspace.reloadLabels}>Retry labels</button></div>}
      {!workspace.labelsLoading && !workspace.labelError && visible.length === 0 && <div className="directory-empty"><Tags size={28} aria-hidden="true" />
        <h3>{filter === 'active' ? 'Give your work a little order' : 'No archived labels'}</h3>
        <p>{filter === 'active' ? 'Add a label, then use it to group related tasks.' : 'Archived labels stay on their tasks. Restore one to use it on new work.'}</p>
        {filter === 'active' && <button className="button button-secondary" type="button" disabled={locked} onClick={() => openEditor(null)}>Add your first label</button>}
      </div>}
      {visible.length > 0 && <ul className="directory-list team-list label-list">{visible.map((label) => <li key={label.id}>
        <div className="team-member-info"><LabelChip label={label} /><span>
          {tasksLoading || taskError ? 'Task count unavailable' : `${usage.get(label.id) ?? 0} tagged ${(usage.get(label.id) ?? 0) === 1 ? 'task' : 'tasks'}`}
        </span></div>
        <span className={`directory-status${label.archived_at ? ' is-archived' : ''}`}>{label.archived_at ? 'Archived' : 'Active'}</span>
        <div className="member-row-actions">
          <button className="button button-secondary" type="button" disabled={locked} aria-label={`Edit ${label.name}`} onClick={() => openEditor(label)}><Pencil size={14} />Edit</button>
          <button className="button button-secondary" type="button" disabled={locked} aria-label={`${label.archived_at ? 'Restore' : 'Archive'} ${label.name}`} onClick={() => void setArchived(label)}>
            {label.archived_at ? <RotateCcw size={14} /> : <Archive size={14} />}
            {pendingId === label.id ? 'Saving…' : label.archived_at ? 'Restore' : 'Archive'}
          </button>
        </div>
      </li>)}</ul>}
      <p className="directory-note">Label names are unique in this workspace. Archiving keeps existing task links and history; restore a label to use it on new tasks.</p>
    </div>
  </section>
}
