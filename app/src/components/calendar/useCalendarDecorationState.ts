import React from "react"
import {
  ACCOUNT_CALENDAR_DECORATION_EVENT,
  accountCalendarDecorationStatus,
  readAccountCalendarDecorationState,
} from "../../domain/account/account-calendar-decoration-service"
import { accountDecorationsEnabled } from "../../domain/account/account-decoration-service"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import {
  CALENDAR_DECORATION_EVENT,
  calendarDecorationReadStatus,
  readCalendarDecorationStateSerialized,
} from "../../domain/calendar-decoration-store"
import { createEmptyCalendarDecorationState, parseStoredCalendarDecorationState, type CalendarDecorationState } from "../../domain/calendar-decoration-schema"

function readTrustedCalendarDecorationState(): CalendarDecorationState | null {
  if (typeof window === "undefined") return null
  if (accountDecorationsEnabled()) {
    const status = accountCalendarDecorationStatus()
    if (status === "EMPTY") return readAccountCalendarDecorationState()
    if (status === "READY" || status === "PENDING") return readAccountCalendarDecorationState()
    return null
  }

  const status = calendarDecorationReadStatus()
  if (status === "EMPTY") {
    return readCalendarDecorationStateSerialized() === null && calendarDecorationReadStatus() === "EMPTY"
      ? createEmptyCalendarDecorationState() : null
  }
  if (status !== "READY") return null
  const serialized = readCalendarDecorationStateSerialized()
  return serialized === null ? null : parseStoredCalendarDecorationState(serialized)
}

/** A read-only, owner-scoped calendar snapshot. Unknown or failed storage is omitted. */
export function useCalendarDecorationState(): CalendarDecorationState | null {
  const [state, setState] = React.useState<CalendarDecorationState | null>(readTrustedCalendarDecorationState)
  React.useEffect(() => {
    const refresh = () => setState(readTrustedCalendarDecorationState())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(CALENDAR_DECORATION_EVENT, refresh)
    window.addEventListener(ACCOUNT_CALENDAR_DECORATION_EVENT, refresh)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(CALENDAR_DECORATION_EVENT, refresh)
      window.removeEventListener(ACCOUNT_CALENDAR_DECORATION_EVENT, refresh)
      unsubscribe()
    }
  }, [])
  return state
}
