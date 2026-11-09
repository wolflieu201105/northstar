import { useEffect, useRef } from 'react'

export function useModalDialog(opener: HTMLElement | null) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => {
        const target = opener?.isConnected && !opener.closest('[hidden]') ? opener
          : document.querySelector<HTMLElement>('#main-content h1[data-view-active="true"]')
        target?.focus({ preventScroll: true })
      })
    }
  }, [opener])
  return dialogRef
}
