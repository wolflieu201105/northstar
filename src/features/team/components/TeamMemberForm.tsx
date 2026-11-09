import { useEffect, useId, useRef, useState } from 'react'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { normalizeMemberDraft } from '../utils'
import { AVATAR_COLORS, AVATAR_COLOR_NAMES, MEMBER_NAME_MAX_LENGTH, type TeamMember, type TeamMemberDraft } from '../types'
import { MemberAvatar } from './MemberAvatar'

interface TeamMemberFormProps {
  member: TeamMember | null
  onSave: (draft: TeamMemberDraft) => Promise<void>
  onClose: () => void
  registerGuard: RegisterNavigationGuard
  opener: HTMLElement | null
}

export function TeamMemberForm({ member, onSave, onClose, registerGuard, opener }: TeamMemberFormProps) {
  const id = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const saving = useRef(false)
  const [initial] = useState<TeamMemberDraft>(() => ({ name: member?.name ?? '', avatar_color: member?.avatar_color as TeamMemberDraft['avatar_color'] ?? null }))
  const [draft, setDraft] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canLeave = useDraftProtection(JSON.stringify(initial) !== JSON.stringify(draft), isSaving, registerGuard)
  useEffect(() => {
    nameRef.current?.focus()
    return () => { window.requestAnimationFrame(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }) }
  }, [opener])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving.current) return
    setError(null)
    let input: TeamMemberDraft
    try { input = normalizeMemberDraft(draft) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Check the member details.'); nameRef.current?.focus(); return }
    saving.current = true; setIsSaving(true)
    try { await onSave(input); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The member could not be saved.') }
    finally { saving.current = false; setIsSaving(false) }
  }
  return <form className="member-editor" aria-labelledby={`${id}-heading`} aria-busy={isSaving} noValidate onSubmit={(event) => void submit(event)}>
    <div className="member-editor-heading"><MemberAvatar member={{ name: draft.name || 'New member', avatar_color: draft.avatar_color }} decorative />
      <div><h2 id={`${id}-heading`}>{member ? 'Edit team member' : 'Add team member'}</h2><p>A profile for assigning work in your private workspace.</p></div></div>
    <fieldset className="form-fields member-editor-fields" disabled={isSaving}>
      <label className="form-field" htmlFor={`${id}-name`}><span>Member name</span>
        <input ref={nameRef} id={`${id}-name`} value={draft.name} maxLength={MEMBER_NAME_MAX_LENGTH} autoComplete="off"
          placeholder="e.g. Alex Lee" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
      </label>
      <fieldset className="avatar-color-picker"><legend>Avatar color <small>Optional</small></legend>
        <div className="avatar-color-options">
          <label className={`avatar-color-option${draft.avatar_color === null ? ' is-selected' : ''}`}>
            <input type="radio" name={`${id}-color`} value="default" checked={draft.avatar_color === null} onChange={() => setDraft((current) => ({ ...current, avatar_color: null }))} />
            <span className="color-dot" aria-hidden="true" /><span>Default</span>
          </label>
          {AVATAR_COLORS.map((color) => <label key={color} className={`avatar-color-option${draft.avatar_color === color ? ' is-selected' : ''}`}>
            <input type="radio" name={`${id}-color`} value={color} checked={draft.avatar_color === color} onChange={() => setDraft((current) => ({ ...current, avatar_color: color }))} />
            <span className="color-dot" style={{ backgroundColor: color }} aria-hidden="true" /><span>{AVATAR_COLOR_NAMES[color]}</span>
          </label>)}
        </div>
      </fieldset>
      {error && <p id={`${id}-error`} className="form-error" role="alert">{error}</p>}
    </fieldset>
    <div className="member-editor-footer"><p role="status">{isSaving ? 'Saving member…' : 'Adding a profile does not send an invitation or share access.'}</p>
      <div><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => { if (canLeave()) onClose() }}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : member ? 'Save member' : 'Add member'}</button></div>
    </div>
  </form>
}
