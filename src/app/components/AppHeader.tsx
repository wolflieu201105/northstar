import { LayoutDashboard, Plus, Sparkles, Tags, Users, Folder, Inbox, UserRound } from 'lucide-react'
import type { WorkspaceController } from '../hooks/useWorkspaceController'

export function AppHeader({ controller }: { controller: WorkspaceController }) {
  const { identity, session, navigation, visit, groupId, openCreate } = controller
  const profile = identity.profile
  return <header className="app-header">
    <a className="brand" href="?" onClick={(event) => { event.preventDefault(); visit('board') }} aria-label="Northstar board home">
      <span className="brand-mark" aria-hidden="true"><Sparkles size={19} strokeWidth={2.4} /></span><span><strong>Northstar</strong><small>Shared project board</small></span>
    </a>
    <nav className="workspace-nav" aria-label="Workspace">
      {([{ view: 'board', label: 'Board', icon: LayoutDashboard }, { view: 'members', label: 'Members', icon: Users }, { view: 'labels', label: 'Labels', icon: Tags },
        { view: 'groups', label: 'Groups', icon: Folder }, { view: 'invitations', label: 'Invitations', icon: Inbox }, { view: 'account', label: 'Account', icon: UserRound }] as const).map((item) =>
        <button type="button" key={item.view} aria-current={navigation.view === item.view ? 'page' : undefined} onClick={() => visit(item.view)}>
          <item.icon size={16} aria-hidden="true" /><span>{item.label}</span>
        </button>)}
    </nav>
    <div className="header-actions">
      <label className="group-switcher">Active group<select value={groupId ?? ''} onChange={(event) => navigation.selectGroup(event.target.value)}>
        <option value="" disabled>{identity.groupsLoading ? 'Loading groups…' : 'Select a group'}</option>
        {identity.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select></label>
      <button className="guest-pill" onClick={() => visit('account')} title="Open your account"><span className="presence-dot" aria-hidden="true" />
        <span>{profile ? `@${profile.username}` : 'Account'}{session.user.is_anonymous ? ' · Guest' : ''}</span></button>
      {groupId && <button className="button button-primary header-create" type="button" onClick={() => openCreate()}><Plus size={18} /><span>New task</span></button>}
    </div>
    {identity.groupsError && <p className="header-error" role="alert">Groups could not be refreshed. <button onClick={identity.reloadGroups}>Retry groups</button></p>}
  </header>
}
