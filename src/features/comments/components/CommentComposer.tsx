import { useId, useRef, useState } from 'react'
import { COMMENT_MAX_LENGTH } from '../types'
import { normalizeCommentBody } from '../utils'

interface CommentComposerProps {
  draft: string
  isPosting: boolean
  error: string | null
  disabled: boolean
  onChange: (draft: string) => void
  onPost: () => Promise<unknown>
}

export function CommentComposer({ draft, isPosting, error, disabled, onChange, onPost }: CommentComposerProps) {
  const id = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const tooLong = draft.trim().length > COMMENT_MAX_LENGTH
  const shownError = tooLong ? 'Comments must contain 1–2,000 characters.' : validationError ?? error
  const blocked = disabled || isPosting
  const valid = Boolean(draft.trim()) && !tooLong
  const post = async () => {
    if (blocked) return
    setValidationError(null); setMessage('')
    try { normalizeCommentBody(draft) }
    catch (reason) {
      setValidationError(reason instanceof Error ? reason.message : 'Check your comment before posting.')
      inputRef.current?.focus(); return
    }
    try {
      const saved = await onPost()
      if (saved) { setMessage('Comment posted.'); inputRef.current?.focus() }
    } catch { /* The detail store retains the save error and draft for retry. */ }
  }
  return <form className="comment-composer" aria-label="Post a comment" aria-busy={isPosting}
    onSubmit={(event) => { event.preventDefault(); void post() }}>
    <label className="form-field" htmlFor={`${id}-comment`}><span>Write a comment</span>
      <textarea ref={inputRef} id={`${id}-comment`} value={draft} maxLength={COMMENT_MAX_LENGTH} rows={3}
        aria-invalid={Boolean(shownError)} aria-describedby={`${id}-count${shownError ? ` ${id}-error` : ''}`}
        onChange={(event) => { setValidationError(null); setMessage(''); onChange(event.target.value) }} disabled={blocked}
        placeholder="Add an update or leave a note…" /></label>
    {shownError && <div id={`${id}-error`} className="form-error" role="alert"><p>{shownError}</p>
      {error && !validationError && !tooLong && <button className="text-button" type="button" disabled={blocked || !valid} onClick={() => void post()}>Retry comment</button>}
    </div>}
    <div className="comment-composer-footer"><small id={`${id}-count`}>{draft.length}/{COMMENT_MAX_LENGTH}</small>
      <button className="button button-primary" type="submit" disabled={blocked || !valid}>
        {isPosting ? 'Posting…' : 'Post comment'}</button></div>
    {message && <p className="comment-posted-message" role="status">{message}</p>}
  </form>
}
