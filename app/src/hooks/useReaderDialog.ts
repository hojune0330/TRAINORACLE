import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react"
import { hasPendingBrowserBackLayer, isBrowserPopNavigationConsumed, subscribeBrowserPopNavigation } from "../navigation/browserNavigation"

export const READER_HISTORY_KEY = "trainoracleReader"
const HISTORY_KEY = READER_HISTORY_KEY

/** Keep native dialogs in the back stack without putting record content in history. */
export function useReaderDialog(dialog: RefObject<HTMLDialogElement | null>, onClose: () => void, returnFocusTo?: () => HTMLElement | null, enabled = true) {
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const fallbackFocus = useRef(returnFocusTo)
  fallbackFocus.current = returnFocusTo
  const closing = useRef(false)
  const createdHistoryEntry = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const [readyRevision, recheckReady] = useState(0)

  useEffect(() => {
    if (!enabled) return
    // A save-result button closes its layer before its native Back finishes.
    // Wait for that POP; opening now would change what the queued Back consumes.
    if (hasPendingBrowserBackLayer()) {
      let resumed = false
      const recheck = () => {
        if (resumed || !enabledRef.current || hasPendingBrowserBackLayer()) return
        resumed = true
        recheckReady(value => value + 1)
      }
      const unsubscribe = subscribeBrowserPopNavigation(recheck)
      // The native POP is also authoritative when a host does not forward a
      // consumed layer POP through its own navigation notification.
      window.addEventListener("popstate", recheck)
      return () => { unsubscribe(); window.removeEventListener("popstate", recheck) }
    }
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
    const onPop = (event: PopStateEvent) => {
      if (isBrowserPopNavigationConsumed(event)) return
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
      if (enabledRef.current) {
        const requestedFocus = fallbackFocus.current?.()
        if (requestedFocus?.isConnected) requestedFocus.focus({ preventScroll: true })
        else if (opener?.isConnected) opener.focus({ preventScroll: true })
      }
    }
  }, [dialog, id, enabled, readyRevision])

  return useCallback(() => {
    if (!enabled || hasPendingBrowserBackLayer()) return
    if (closing.current) return
    if (window.history.state?.[HISTORY_KEY] === id) {
      closing.current = true
      window.history.back()
    } else closeRef.current()
  }, [id, enabled, readyRevision])
}
