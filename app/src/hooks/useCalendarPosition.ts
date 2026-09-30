import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { isValidIsoDate } from "../domain/dates"
import type { CalendarPosition } from "../domain/calendar-context"

// Navigation metadata only, confined to this app lifetime and cleared on every owner change.
const positions = new Map<string, CalendarPosition>()
const scrollPositions = new Map<string, number>()
const listeners = new Set<() => void>()
let listening = false
const notify = () => listeners.forEach(listener => listener())
export function rememberCalendarDate(identity: string, date: string) {
  if (!isValidIsoDate(date)) return
  positions.set(`${activeLocalAccount() ?? "guest"}:${identity}`, { date, month: date.slice(0, 7) }); notify()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!listening && typeof window !== "undefined") {
    listening = true
    onLocalJournalScopeChange(() => { positions.clear(); scrollPositions.clear(); notify() })
  }
  return () => { listeners.delete(listener) }
}

export function useCalendarScroll(identity: string) {
  const root = useRef<HTMLDivElement>(null)
  const key = `${activeLocalAccount() ?? "guest"}:${identity}`
  useLayoutEffect(() => {
    const region = root.current?.closest<HTMLElement>(".app-scroll-region")
    if (!region) return
    let restoring = true
    const top = scrollPositions.get(key)
    const frame = requestAnimationFrame(() => {
      if (top !== undefined) region.scrollTop = top
      restoring = false
    })
    const save = () => { if (!restoring) scrollPositions.set(key, region.scrollTop) }
    const cancelRestore = () => { cancelAnimationFrame(frame); restoring = false }
    region.addEventListener("scroll", save, { passive: true })
    region.addEventListener("wheel", cancelRestore, { passive: true })
    region.addEventListener("touchmove", cancelRestore, { passive: true })
    region.addEventListener("keydown", cancelRestore)
    return () => {
      cancelAnimationFrame(frame); region.removeEventListener("scroll", save)
      region.removeEventListener("wheel", cancelRestore); region.removeEventListener("touchmove", cancelRestore)
      region.removeEventListener("keydown", cancelRestore)
    }
  }, [key])
  return root
}

export function useCalendarPosition(identity: string, initialDate: string, ready = true) {
  const key = `${activeLocalAccount() ?? "guest"}:${identity}`
  const saved = useSyncExternalStore(subscribe, () => positions.get(key), () => undefined)
  const position = saved ?? { month: initialDate.slice(0, 7), date: initialDate }
  useLayoutEffect(() => {
    if (ready && !positions.has(key) && isValidIsoDate(initialDate)) {
      positions.set(key, { month: initialDate.slice(0, 7), date: initialDate }); notify()
    }
  }, [key, initialDate, ready])
  const selectDate = useCallback((date: string) => {
    if (!isValidIsoDate(date)) return
    positions.set(key, { date, month: date.slice(0, 7) }); notify()
  }, [key])
  const selectMonth = useCallback((month: string) => {
    if (!isValidIsoDate(`${month}-01`)) return
    const previous = positions.get(key)
    positions.set(key, { month, date: previous?.date ?? initialDate }); notify()
  }, [key, initialDate])
  const markManual = useCallback(() => {
    if (!positions.has(key) && isValidIsoDate(initialDate)) {
      positions.set(key, { date: initialDate, month: initialDate.slice(0, 7) }); notify()
    }
  }, [key, initialDate])
  return { ...position, selectDate, selectMonth, markManual, initialized: saved !== undefined }
}
