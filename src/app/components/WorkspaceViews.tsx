import { lazy, Suspense } from 'react'
import type { WorkspaceController } from '../hooks/useWorkspaceController'
import type { AuthController } from '../../features/auth/useAuthSession'
import { BoardPage } from '../../features/board/pages/BoardPage'

const MembersPage = lazy(() => import('../../features/groups/pages/MembersPage').then((m) => ({ default: m.MembersPage })))
const GroupsPage = lazy(() => import('../../features/groups/pages/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const InvitationsPage = lazy(() => import('../../features/groups/pages/InvitationsPage').then((m) => ({ default: m.InvitationsPage })))
const AccountPage = lazy(() => import('../../features/account/pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const LabelsPage = lazy(() => import('../../features/labels/pages/LabelsPage').then((m) => ({ default: m.LabelsPage })))

export function WorkspaceViews({ controller, auth }: { controller: WorkspaceController; auth: AuthController }) {
  const { client, session, identity, group, navigation, workspace, taskState, openCreate, openTask, visit, refreshGroup } = controller
  const userId = session.user.id
  const scoped = navigation.view === 'board' || navigation.view === 'members' || navigation.view === 'labels'
  return <>
    {group && <div hidden={navigation.view !== 'board'} key={group.id}>
      <BoardPage taskState={taskState} workspace={workspace} filters={navigation} isActive={navigation.view === 'board'}
        groupName={group.name} scrollPosition={navigation.getScroll(group.id)} onScroll={(position) => navigation.saveScroll(group.id, position)}
        onCreate={openCreate} onOpenTask={openTask} onManageTeam={() => visit('members')} onRefresh={refreshGroup} />
    </div>}
    {scoped && !group && <section className="workspace-directory group-panel">
      {identity.groupsLoading ? <p role="status">Loading groups…</p> : identity.groupsError ? <p role="alert">{identity.groupsError}</p> : <>
        <h1 id="workspace-title" tabIndex={-1}>{navigation.groupId ? 'This group is unavailable' : 'Choose a group to start'}</h1>
        <p>{navigation.groupId ? 'You may no longer be a member, or the group may have been deleted.' : 'Create a group or accept an invitation to work together.'}</p>
      </>}
      <div className="form-actions"><button className="button button-secondary" onClick={identity.reloadGroups}>Refresh groups</button><button className="button button-primary" onClick={() => visit('groups')}>Open Groups</button></div>
    </section>}
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
      {navigation.view === 'account' && <AccountPage auth={auth} identity={identity} registerGuard={navigation.registerGuard} canSwitch={navigation.canLeave} onProfileSaved={workspace.reloadMembers} />}
      {navigation.view === 'groups' && <GroupsPage client={client} userId={userId} identity={identity} selected={group} registerGuard={navigation.registerGuard}
        onSelect={navigation.selectGroup} onMembers={() => visit('members')} />}
      {navigation.view === 'invitations' && <InvitationsPage client={client} userId={userId} registerGuard={navigation.registerGuard} onChanged={identity.reloadGroups} />}
      {group && navigation.view === 'members' && <MembersPage key={group.id} client={client} userId={userId} group={group} registerGuard={navigation.registerGuard} onChanged={refreshGroup} onAccount={() => visit('account')} />}
      {group && navigation.view === 'labels' && <LabelsPage key={group.id} workspace={workspace} tasks={taskState.tasks} tasksLoading={taskState.isLoading} taskError={taskState.loadError} registerGuard={navigation.registerGuard} />}
    </Suspense>
  </>
}
