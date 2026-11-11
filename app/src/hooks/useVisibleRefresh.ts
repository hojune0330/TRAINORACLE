import { useEffect, useRef } from "react"
import { startVisibleRefresh } from "./visible-refresh-scheduler"

/** The keyed account session owns cancellation and rejects stale responses. */
export function useVisibleRefresh(refresh: () => Promise<boolean>, enabled: boolean, scope: string | null, waiting = false) {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    if (!enabled || !scope) return
    const scheduler = startVisibleRefresh(() => latest.current(), () => document.visibilityState !== "hidden" && navigator.onLine !== false,
      { now: Date.now, set: (run, delay) => window.setTimeout(run, delay), clear: timer => window.clearTimeout(timer as number | undefined) }, waiting)
    window.addEventListener("focus", scheduler.wake); window.addEventListener("online", scheduler.wake)
    window.addEventListener("offline", scheduler.wake); document.addEventListener("visibilitychange", scheduler.wake)
    return () => {
      scheduler.stop()
      window.removeEventListener("focus", scheduler.wake); window.removeEventListener("online", scheduler.wake)
      window.removeEventListener("offline", scheduler.wake); document.removeEventListener("visibilitychange", scheduler.wake)
    }
  }, [enabled, scope, waiting])
}
