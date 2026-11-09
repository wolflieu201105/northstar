import type { AppClient } from '../../../shared/lib/supabase'
import type { Group } from '../types'
import type { RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { InviteForm } from '../components/InviteForm'
import { MemberList } from '../components/MemberList'

interface Props { client: AppClient; userId: string; group: Group; registerGuard: RegisterNavigationGuard; onChanged: () => void; onAccount: () => void }
export function MembersPage(props: Props) {
  return <section className="workspace-directory" aria-labelledby="workspace-title">
    <header className="directory-intro"><span className="eyebrow">{props.group.name}</span><h1 id="workspace-title" tabIndex={-1}>Members</h1><p>Everyone here can edit tasks and invite other accounts.</p></header>
    <InviteForm client={props.client} groupId={props.group.id} registerGuard={props.registerGuard} onSent={props.onChanged} />
    <MemberList {...props} />
  </section>
}
