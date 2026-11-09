import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw, Users } from 'lucide-react'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import type { TaskView } from '../../tasks/types'
import type { TeamMember } from '../types'
import { MemberAvatar } from '../components/MemberAvatar'
import { TeamMemberForm } from '../components/TeamMemberForm'

interface TeamPageProps {
  workspace: ReturnType<typeof useWorkspaceData>
  tasks: TaskView[]
  tasksLoading: boolean
  taskError: string | null
  registerGuard: RegisterNavigationGuard
}
interface EditorState { member: TeamMember | null; opener: HTMLElement | null }

export function TeamPage({ workspace, tasks, tasksLoading, taskError, registerGuard }: TeamPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const archivePending = useRef(false)
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [])
  useDraftProtection(false, pendingId !== null, registerGuard)
  const active = workspace.members.filter((member) => !member.archived_at)
  const archived = workspace.members.filter((member) => member.archived_at)
  const visible = (filter === 'active' ? active : archived).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) for (const member of task.assignees) counts.set(member.id, (counts.get(member.id) ?? 0) + 1)
    return counts
  }, [tasks])
  const locked = editor !== null || pendingId !== null
  const openEditor = (member: TeamMember | null) => {
    if (locked) return
    setError(null); setMessage('')
    setEditor({ member, opener: document.activeElement as HTMLElement | null })
    if (!member) setFilter('active')
  }
  const setArchived = async (member: TeamMember) => {
    if (locked || archivePending.current) return
    const archive = !member.archived_at
    archivePending.current = true; setPendingId(member.id); setError(null); setMessage('')
    try {
      await workspace.setMemberArchived(member.id, archive)
      setMessage(`${member.name} ${archive ? 'archived. Existing task assignments are retained.' : 'restored and available for assignment.'}`)
      window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The member could not be updated.') }
    finally { archivePending.current = false; setPendingId(null) }
  }
  return <section className="workspace-directory team-page" aria-labelledby="workspace-title">
    <div className="directory-intro team-page-intro"><div><span className="eyebrow">My workspace</span>
      <h1 ref={headingRef} id="workspace-title" tabIndex={-1} data-view-active="true">Team</h1>
      <p>Profiles you can assign to tasks. Your workspace stays private to this guest session.</p></div>
      <button className="button button-primary" type="button" disabled={locked} onClick={() => openEditor(null)}><Plus size={17} />Add member</button>
    </div>
    {editor && <TeamMemberForm key={editor.member?.id ?? 'new-member'} member={editor.member} opener={editor.opener} registerGuard={registerGuard}
      onClose={() => setEditor(null)} onSave={async (draft) => {
        const saved = editor.member ? await workspace.editMember(editor.member.id, draft) : await workspace.addMember(draft)
        setMessage(`${saved.name} ${editor.member ? 'updated' : 'added to your team'}.`)
      }} />}
    <p className="team-action-message" role="status" aria-live="polite">{message}</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="directory-panel">
      <div className="directory-panel-heading"><Users size={20} aria-hidden="true" /><h2>Team members</h2></div>
      <div className="directory-filters" role="group" aria-label="Member status">
        <button type="button" aria-pressed={filter === 'active'} disabled={locked} onClick={() => setFilter('active')}>Active{!workspace.membersLoading && !workspace.memberError ? ` (${active.length})` : ''}</button>
        <button type="button" aria-pressed={filter === 'archived'} disabled={locked} onClick={() => setFilter('archived')}>Archived{!workspace.membersLoading && !workspace.memberError ? ` (${archived.length})` : ''}</button>
      </div>
      {workspace.membersLoading && <p className="directory-message" role="status">Loading team members…</p>}
      {workspace.memberError && <div className="inline-error" role="alert"><p>{workspace.memberError}</p>
        <button className="button button-secondary" type="button" disabled={pendingId !== null || workspace.membersLoading} onClick={workspace.reloadMembers}>Retry team</button></div>}
      {!workspace.membersLoading && !workspace.memberError && visible.length === 0 && <div className="directory-empty"><Users size={28} aria-hidden="true" />
        <h3>{filter === 'active' ? 'Your team starts here' : 'No archived members'}</h3>
        <p>{filter === 'active' ? 'Add a name and an optional color, then assign the profile to a task.' : 'Archived profiles keep their existing assignments. Restore one to assign new work.'}</p>
        {filter === 'active' && <button className="button button-secondary" type="button" disabled={locked} onClick={() => openEditor(null)}>Add your first member</button>}
      </div>}
      {visible.length > 0 && <ul className="directory-list team-list">{visible.map((member) => <li key={member.id}>
        <MemberAvatar member={member} decorative />
        <div className="team-member-info"><strong>{member.name}</strong><span>
          {tasksLoading || taskError ? 'Assignment count unavailable' : `${usage.get(member.id) ?? 0} assigned ${(usage.get(member.id) ?? 0) === 1 ? 'task' : 'tasks'}`}
        </span></div>
        <span className={`directory-status${member.archived_at ? ' is-archived' : ''}`}>{member.archived_at ? 'Archived' : 'Active'}</span>
        <div className="member-row-actions">
          <button className="button button-secondary" type="button" disabled={locked} aria-label={`Edit ${member.name}`} onClick={() => openEditor(member)}><Pencil size={14} />Edit</button>
          <button className="button button-secondary" type="button" disabled={locked} aria-label={`${member.archived_at ? 'Restore' : 'Archive'} ${member.name}`} onClick={() => void setArchived(member)}>
            {member.archived_at ? <RotateCcw size={14} /> : <Archive size={14} />}
            {pendingId === member.id ? 'Saving…' : member.archived_at ? 'Restore' : 'Archive'}
          </button>
        </div>
      </li>)}</ul>}
      <p className="directory-note">Members are workspace profiles. Adding one does not send an invitation or give anyone access. Archiving keeps existing task links and history.</p>
    </div>
  </section>
}
