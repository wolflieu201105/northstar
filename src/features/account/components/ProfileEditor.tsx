import { useState } from 'react'
import type { Profile, ProfileDraft } from '../types'
import { AVATAR_COLORS, AVATAR_COLOR_NAMES } from '../../team/types'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'

const draftOf = (profile: Profile): ProfileDraft => ({ username: profile.username, display_name: profile.display_name, avatar_color: profile.avatar_color })

interface Props { profile: Profile; onSave: (draft: ProfileDraft) => Promise<Profile>; registerGuard: RegisterNavigationGuard }
export function ProfileEditor({ profile, onSave, registerGuard }: Props) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftOf(profile))
  const [saved, setSaved] = useState(draft)
  const [observed, setObserved] = useState(profile.updated_at)
  const action = useAction()
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  if (profile.updated_at !== observed) {
    setObserved(profile.updated_at)
    if (!dirty && !action.busy) { const next = draftOf(profile); setDraft(next); setSaved(next) }
  }
  useDraftProtection(dirty, action.busy, registerGuard)
  return <form aria-label="Edit your profile" className="account-form" onSubmit={(event) => { event.preventDefault(); void action.run(async () => {
    const result = await onSave(draft)
    const next = draftOf(result)
    setDraft(next); setSaved(next)
    return 'Profile saved. Use your username or account ID for invitations.'
  }) }}>
    <h2>Your profile</h2>
    {dirty && JSON.stringify(draftOf(profile)) !== JSON.stringify(saved) && <p className="detail-hint">Your profile changed elsewhere. Your draft is preserved.</p>}
    <label>Unique username<input required minLength={3} maxLength={30} autoComplete="username" value={draft.username} disabled={action.busy} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label>
    <label>Display name<input required maxLength={80} autoComplete="nickname" value={draft.display_name} disabled={action.busy} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
    <label>Avatar color<select value={draft.avatar_color ?? ''} disabled={action.busy} onChange={(event) => setDraft({ ...draft, avatar_color: event.target.value || null })}>
      <option value="">Default</option>{AVATAR_COLORS.map((color) => <option key={color} value={color}>{AVATAR_COLOR_NAMES[color]}</option>)}
    </select></label>
    <button className="button button-primary" disabled={action.busy || !dirty}>{action.busy ? 'Saving…' : 'Save profile'}</button>
    <ActionFeedback {...action} />
  </form>
}
