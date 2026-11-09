export function ActionFeedback({ error, message }: { error: string | null; message: string }) {
  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="action-message" role="status" aria-live="polite">{message}</p>
  </>
}
