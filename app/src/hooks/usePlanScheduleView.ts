import { useCallback, useLayoutEffect, useSyncExternalStore } from "react"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"

export type PlanScheduleView = "calendar" | "list"

// View preferences are navigation metadata only. They never enter device or
// account storage, and every account boundary discards the previous session.
const views = new Map<string, PlanScheduleView>()
const listeners = new Set<() => void>()
let revision = 0
let listening = false
const snapshot = () => revision
const notify = () => { revision += 1; listeners.forEach(listener => listener()) }

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!listening && typeof window !== "undefined") {
    listening = true
    onLocalJournalScopeChange(() => { views.clear(); notify() })
  }
  return () => { listeners.delete(listener) }
}

function initialView(): PlanScheduleView {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 767px)").matches ? "list" : "calendar"
}

/** A controlled consumer disables its own preference writes. */
export function usePlanScheduleView(identity: string, enabled = true) {
  useSyncExternalStore(subscribe, snapshot, () => 0)
  const generation = localJournalScopeGeneration()
  const key = JSON.stringify([activeLocalAccount(), identity])
  const view = views.get(key) ?? initialView()

  useLayoutEffect(() => {
    if (!enabled || generation !== localJournalScopeGeneration() || views.has(key)) return
    views.set(key, view); notify()
  }, [enabled, generation, key, view])

  const selectView = useCallback((next: PlanScheduleView) => {
    if (!enabled || generation !== localJournalScopeGeneration() || views.get(key) === next) return
    views.set(key, next); notify()
  }, [enabled, generation, key])

  return { view, selectView }
}
