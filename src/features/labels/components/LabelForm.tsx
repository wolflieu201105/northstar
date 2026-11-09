import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { labelNameKey, normalizeLabelDraft } from '../utils'
import { LabelNameConflictError } from '../services/labels'
import { LABEL_NAME_MAX_LENGTH, type Label, type LabelDraft } from '../types'
import { AVATAR_COLORS, AVATAR_COLOR_NAMES } from '../../team/types'
import { LabelChip } from './LabelChip'

interface LabelFormProps {
  label: Label | null
  labels: Label[]
  onSave: (draft: LabelDraft) => Promise<void>
  onRestore: (label: Label) => Promise<void>
  onClose: () => void
  registerGuard: RegisterNavigationGuard
  opener: HTMLElement | null
  onReloadLabels?: () => void
}

export function LabelForm({ label, labels, onSave, onRestore, onClose, registerGuard, opener, onReloadLabels }: LabelFormProps) {
  const id = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const writing = useRef(false)
  const [initial] = useState<LabelDraft>(() => ({ name: label?.name ?? '', color: label?.color as LabelDraft['color'] ?? '#20895b' }))
  const [draft, setDraft] = useState(initial)
  const [pending, setPending] = useState<'save' | 'restore' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverConflict, setServerConflict] = useState<Label | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const duplicate = labels.find((row) => row.id !== label?.id && labelNameKey(row.name) === labelNameKey(draft.name))
    ?? (serverConflict && labelNameKey(serverConflict.name) === labelNameKey(draft.name) ? serverConflict : null)
  const duplicateMessage = duplicate ? duplicate.archived_at
    ? 'This name belongs to an archived label. Restore it or choose another name.'
    : 'A label with this name already exists. Choose another name.' : null
  const canLeave = useDraftProtection(JSON.stringify(initial) !== JSON.stringify(draft), pending !== null, registerGuard)
  useEffect(() => {
    nameRef.current?.focus()
    return () => { window.requestAnimationFrame(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }) }
  }, [opener])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (writing.current) return
    setError(null); setNeedsReload(false)
    let input: LabelDraft
    try { input = normalizeLabelDraft(draft) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Check the label details.'); nameRef.current?.focus(); return }
    if (duplicate) { nameRef.current?.focus(); return }
    writing.current = true; setPending('save')
    try { await onSave(input); onClose() }
    catch (reason) {
      if (reason instanceof LabelNameConflictError) { setServerConflict(reason.existingLabel); setNeedsReload(reason.existingLabel === null) }
      setError(reason instanceof Error ? reason.message : 'The label could not be saved.')
    } finally { writing.current = false; setPending(null) }
  }
  const restore = async () => {
    if (!duplicate?.archived_at || writing.current) return
    writing.current = true; setPending('restore'); setError(null)
    try { await onRestore(duplicate); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The label could not be restored.') }
    finally { writing.current = false; setPending(null) }
  }
  return <form className="member-editor label-editor" aria-labelledby={`${id}-heading`} aria-busy={pending !== null} noValidate onSubmit={(event) => void submit(event)}>
    <div className="member-editor-heading"><div><h2 id={`${id}-heading`}>{label ? 'Edit label' : 'Add label'}</h2>
      <p>Give related tasks a name and a color.</p></div></div>
    <fieldset className="form-fields member-editor-fields" disabled={pending !== null}>
      <label className="form-field" htmlFor={`${id}-name`}><span>Label name</span>
        <input ref={nameRef} id={`${id}-name`} value={draft.name} maxLength={LABEL_NAME_MAX_LENGTH} autoComplete="off"
          placeholder="e.g. Bug, Feature, Design" aria-invalid={Boolean(error || duplicate)} aria-describedby={error || duplicate ? `${id}-error` : undefined}
          onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(null); setServerConflict(null); setNeedsReload(false) }} />
      </label>
      <fieldset className="avatar-color-picker"><legend>Label color</legend><div className="avatar-color-options">
        {AVATAR_COLORS.map((color) => <label key={color} className={`avatar-color-option${draft.color === color ? ' is-selected' : ''}`}>
          <input type="radio" name={`${id}-color`} value={color} checked={draft.color === color} onChange={() => setDraft((current) => ({ ...current, color }))} />
          <span className="color-dot" style={{ backgroundColor: color }} aria-hidden="true" /><span>{AVATAR_COLOR_NAMES[color]}</span>
        </label>)}
      </div></fieldset>
      <div className="label-preview"><span>Preview</span><LabelChip label={{ name: draft.name.trim() || 'Label', color: draft.color }} /></div>
      {(duplicate || error) && <div id={`${id}-error`} className="form-error" role="alert">
        <p>{duplicateMessage ?? error}</p>
        {duplicate?.archived_at && <div className="label-restore-offer"><LabelChip label={duplicate} />
          <p>Restore the existing label with its saved name, color, and task links.</p>
          <button className="button button-secondary" type="button" disabled={pending !== null} onClick={() => void restore()}><RotateCcw size={14} />{pending === 'restore' ? 'Restoring…' : 'Restore existing label'}</button>
        </div>}
        {duplicate && error && error !== duplicateMessage && <p>{error}</p>}
        {needsReload && !duplicate && onReloadLabels && <button className="text-button" type="button" onClick={onReloadLabels}>Reload labels</button>}
      </div>}
    </fieldset>
    <div className="member-editor-footer"><p role="status">{pending ? pending === 'restore' ? 'Restoring label…' : 'Saving label…' : 'Label names are unique within your workspace, including archived labels.'}</p>
      <div><button className="button button-secondary" type="button" disabled={pending !== null} onClick={() => { if (canLeave()) onClose() }}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={pending !== null || Boolean(duplicate)}>{pending === 'save' ? 'Saving…' : label ? 'Save label' : 'Add label'}</button></div>
    </div>
  </form>
}
