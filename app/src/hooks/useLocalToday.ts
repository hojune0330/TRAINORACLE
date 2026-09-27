import { useEffect, useState } from "react"
import { todayISO } from "../domain/journal-store"

/** Refresh the local civil date at midnight and after a suspended tab resumes. */
export function useLocalToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      setToday(todayISO())
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      // No timezone-change event exists: visible tabs recheck at most once a minute.
      const midnightDelay = Math.max(100, next.getTime() - now.getTime() + 50)
      timer = setTimeout(refresh, document.hidden ? midnightDelay : Math.min(60_000, midnightDelay))
    }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [])
  return today
}
