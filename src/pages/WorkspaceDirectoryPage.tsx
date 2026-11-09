import { useEffect, useRef } from 'react'
import { Tags, Users } from 'lucide-react'
import type { useWorkspaceData } from '../hooks/useWorkspaceData'

interface WorkspaceDirectoryPageProps {
  view: 'team' | 'labels'
  workspace: ReturnType<typeof useWorkspaceData>
}

export function WorkspaceDirectoryPage({ view, workspace }: WorkspaceDirectoryPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [view])
  const isTeam = view === 'team'
  const items = isTeam ? workspace.members.map((member) => ({ ...member, color: member.avatar_color })) : workspace.labels
  const isLoading = isTeam ? workspace.membersLoading : workspace.labelsLoading
  const error = isTeam ? workspace.memberError : workspace.labelError
  const Icon = isTeam ? Users : Tags
  return <section className="workspace-directory" aria-labelledby="workspace-title">
    <div className="directory-intro"><span className="eyebrow">My workspace</span>
      <h1 ref={headingRef} id="workspace-title" tabIndex={-1} data-view-active="true">{isTeam ? 'Team' : 'Labels'}</h1>
      <p>{isTeam ? 'Profiles you can assign to work in this private guest workspace.' : 'Organize tasks with shared labels in this workspace.'}</p>
    </div>
    <div className="directory-panel">
      <div className="directory-panel-heading"><Icon size={20} aria-hidden="true" /><h2>{isTeam ? 'Team members' : 'Workspace labels'}</h2>
        {!isLoading && !error && <span>{items.length}</span>}</div>
      {isLoading ? <p className="directory-message" role="status">Loading {isTeam ? 'members' : 'labels'}…</p>
        : error ? <div className="inline-error" role="alert"><p>{error}</p>
          <button className="button button-secondary" type="button" onClick={isTeam ? workspace.reloadMembers : workspace.reloadLabels}>Retry</button></div>
        : items.length === 0 ? <div className="directory-empty"><Icon size={28} aria-hidden="true" />
          <h3>{isTeam ? 'Your team starts here' : 'A little order goes a long way'}</h3>
          <p>{isTeam ? 'No team profiles have been added to this workspace yet.' : 'No labels have been added to this workspace yet.'}</p></div>
        : <ul className="directory-list">{items.map((item) => <li key={item.id}>
          <span className="directory-swatch" style={{ backgroundColor: item.color ?? 'var(--accent)' }} aria-hidden="true">
            {isTeam ? item.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : <Tags size={16} />}</span>
          <strong>{item.name}</strong><span className={`directory-status${item.archived_at ? ' is-archived' : ''}`}>{item.archived_at ? 'Archived' : 'Active'}</span>
        </li>)}</ul>}
      {items.length > 0 && <p className="directory-note">{isTeam ? 'Select active profiles in a task’s Assignees field. Team profiles do not share access to this private workspace.' : 'Select active labels in a task’s Labels field. Existing archived labels stay visible on their tasks.'}</p>}
    </div>
  </section>
}
