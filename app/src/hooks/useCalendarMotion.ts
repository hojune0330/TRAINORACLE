import { useSyncExternalStore } from "react"

const KEY = "trainoracle.calendar-reduced-motion.v1"
const EVENT = "trainoracle:calendar-motion"
const QUERY = "(prefers-reduced-motion: reduce)"
function savedPreference() {
  try { return window.localStorage.getItem(KEY) === "true" } catch { return false }
}
let memoryPreference: boolean | undefined
const appPreference = () => memoryPreference ?? savedPreference()
export function calendarReducedMotion() {
  return appPreference() || (window.matchMedia?.(QUERY).matches ?? false)
}
function subscribe(listener: () => void) {
  const media = window.matchMedia?.(QUERY)
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { memoryPreference = undefined; listener() } }
  window.addEventListener(EVENT, listener)
  window.addEventListener("storage", storage)
  media?.addEventListener?.("change", listener)
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", storage); media?.removeEventListener?.("change", listener) }
}
export function useCalendarMotion() {
  const reduced = useSyncExternalStore(subscribe, calendarReducedMotion, () => true)
  const chosen = useSyncExternalStore(subscribe, appPreference, () => false)
  return { reduced, chosen, setReduced(value: boolean) {
    memoryPreference = value
    try { window.localStorage.setItem(KEY, String(value)) } catch { /* Keep the preference for this tab. */ }
    window.dispatchEvent(new Event(EVENT))
  } }
}
