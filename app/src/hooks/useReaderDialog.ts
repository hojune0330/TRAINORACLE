import { useCallback, useEffect, useId, useRef, type RefObject } from "react"

export const READER_HISTORY_KEY = "trainoracleReader"
const HISTORY_KEY = READER_HISTORY_KEY

/** Keep native dialogs in the back stack without putting record content in history. */
export function useReaderDialog(dialog: RefObject<HTMLDialogElement | null>, onClose: () => void, returnFocusTo?: () => HTMLElement | null) {
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const fallbackFocus = useRef(returnFocusTo)
  fallbackFocus.current = returnFocusTo
  const closing = useRef(false)
  const createdHistoryEntry = useRef(false)

  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const region = opener?.closest<HTMLElement>(".app-scroll-region, .plan-day-reader__body")
    const top = region?.scrollTop ?? 0
    const overflow = document.body.style.overflow
    const previousState = window.history.state
    let ownsEntry = false
    closing.current = false
    try {
      const method = createdHistoryEntry.current ? "replaceState" : "pushState"
      window.history[method]({ ...previousState, [HISTORY_KEY]: id }, "", window.location.href)
      createdHistoryEntry.current = true
      ownsEntry = true
    } catch { /* The reader still works when the browser disallows history writes. */ }
    document.body.style.overflow = "hidden"
    element?.showModal()
    const onPop = () => {
      if (window.history.state?.[HISTORY_KEY] !== id) closeRef.current()
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      if (ownsEntry && window.history.state?.[HISTORY_KEY] === id) {
        window.history.replaceState(previousState, "", window.location.href)
      }
      if (element?.open && typeof element.close === "function") element.close()
      document.body.style.overflow = overflow
      if (region?.isConnected) region.scrollTop = top
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      else fallbackFocus.current?.()?.focus({ preventScroll: true })
    }
  }, [dialog, id])

  return useCallback(() => {
    if (closing.current) return
    if (window.history.state?.[HISTORY_KEY] === id) {
      closing.current = true
      window.history.back()
    } else closeRef.current()
  }, [id])
}
