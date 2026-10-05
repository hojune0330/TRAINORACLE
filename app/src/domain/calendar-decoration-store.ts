import { accountScopedStorageKey } from "./account/local-account-scope"
import { accountDecorationsEnabled } from "./account/account-decoration-service"
import { readAccountCalendarDecorationState, persistAccountCalendarDecorations } from "./account/account-calendar-decoration-service"
import { loadDecorationState } from "./decoration-store"
import { calendarDecorationStateSchema, calendarDecorationsOwnedBy, createEmptyCalendarDecorationState,
  parseStoredCalendarDecorationState, type CalendarDecorationState } from "./calendar-decoration-schema"

export const CALENDAR_DECORATION_STORAGE_KEY = "trainoracle.calendar-decorations.v1"
export const CALENDAR_DECORATION_EVENT = "trainoracle:calendar-decorations-changed"
export const activeCalendarDecorationStorageKey = () => accountScopedStorageKey(CALENDAR_DECORATION_STORAGE_KEY)
export type CalendarDecorationSaveFailureCode = "INVALID_STATE" | "STORAGE_UNAVAILABLE" | "STALE_STATE"
  | "WRITE_FAILED" | "READBACK_MISMATCH" | "ROLLBACK_FAILED" | "OWNERSHIP_STATE_CHANGED" | "UNSUPPORTED"
export type CalendarDecorationSaveResult = { ok: true } | { ok: false; code: CalendarDecorationSaveFailureCode }

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage } catch { return null }
}
export function readCalendarDecorationStateSerialized(): string | null {
  if (accountDecorationsEnabled()) {
    const state = readAccountCalendarDecorationState()
    return state ? JSON.stringify(state) : null
  }
  try { return storage()?.getItem(activeCalendarDecorationStorageKey()) ?? null } catch { return null }
}
export function loadCalendarDecorationState(): CalendarDecorationState {
  if (accountDecorationsEnabled()) return readAccountCalendarDecorationState() ?? createEmptyCalendarDecorationState()
  const raw = readCalendarDecorationStateSerialized()
  return raw === null ? createEmptyCalendarDecorationState() : parseStoredCalendarDecorationState(raw) ?? createEmptyCalendarDecorationState()
}
export function calendarDecorationReadStatus(): "READY" | "EMPTY" | "UNSUPPORTED" | "FAILED" {
  const target = storage()
  if (!target) return "FAILED"
  try {
    const raw = target.getItem(activeCalendarDecorationStorageKey())
    return raw === null ? "EMPTY" : parseStoredCalendarDecorationState(raw) ? "READY" : "UNSUPPORTED"
  } catch { return "FAILED" }
}

export function saveCalendarDecorationStateIfCurrent(candidate: unknown, expectedSerialized?: string | null): CalendarDecorationSaveResult {
  if (accountDecorationsEnabled()) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  const parsed = calendarDecorationStateSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, code: "INVALID_STATE" }
  if (!calendarDecorationsOwnedBy(parsed.data, loadDecorationState())) return { ok: false, code: "OWNERSHIP_STATE_CHANGED" }
  const target = storage()
  if (!target) return { ok: false, code: "STORAGE_UNAVAILABLE" }
  const key = activeCalendarDecorationStorageKey()
  let previous: string | null
  try { previous = target.getItem(key) } catch { return { ok: false, code: "STORAGE_UNAVAILABLE" } }
  if (expectedSerialized !== undefined && previous !== expectedSerialized) return { ok: false, code: "STALE_STATE" }
  if (previous !== null && parseStoredCalendarDecorationState(previous) === null) return { ok: false, code: "UNSUPPORTED" }
  const serialized = JSON.stringify(parsed.data)
  const rollback = () => {
    try {
      const current = target.getItem(key)
      if (current === previous) return true
      if (current !== serialized
        && (current === null || parseStoredCalendarDecorationState(current) !== null)) return false
      if (previous === null) target.removeItem(key)
      else target.setItem(key, previous)
      return target.getItem(key) === previous
    } catch { return false }
  }
  try { target.setItem(key, serialized) } catch {
    return { ok: false, code: rollback() ? "WRITE_FAILED" : "ROLLBACK_FAILED" }
  }
  try {
    if (target.getItem(key) !== serialized) return { ok: false, code: rollback() ? "READBACK_MISMATCH" : "ROLLBACK_FAILED" }
  } catch { return { ok: false, code: rollback() ? "READBACK_MISMATCH" : "ROLLBACK_FAILED" } }
  window.dispatchEvent(new Event(CALENDAR_DECORATION_EVENT))
  return { ok: true }
}

export async function persistCalendarDecorationStateIfCurrent(candidate: unknown, expectedSerialized: string | null): Promise<
  { ok: true; storage: "LOCAL" | "ACCOUNT" | "PENDING"; state: CalendarDecorationState }
  | { ok: false; code: CalendarDecorationSaveFailureCode }> {
  if (accountDecorationsEnabled()) return persistAccountCalendarDecorations(candidate, expectedSerialized)
  const result = saveCalendarDecorationStateIfCurrent(candidate, expectedSerialized)
  return result.ok ? { ok: true, storage: "LOCAL", state: calendarDecorationStateSchema.parse(candidate) } : result
}
