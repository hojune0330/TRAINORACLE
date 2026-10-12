import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import { isValidIsoDate } from "../domain/dates"
import type { JournalEntry } from "../domain/journal-schema"

/** Ephemeral reader position only: never persists input or crosses an account lifetime. */
export type ReaderPosition = {
  readonly scope: number
  readonly scroll: number
  readonly focusId: string | null
  readonly focusDate: string | null
  readonly focusLabel: string | null
  readonly focusText: string | null
}

/** In-memory return metadata only; record content never belongs in browser history. */
export type JournalCalendarReturn = {
  readonly scope: number
  readonly date: string
  readonly entryId: string | null
  readonly scroll: number
}

export type OpenJournalDay = (date: string, entryId?: string, calendarReturn?: JournalCalendarReturn) => void

export function validJournalCalendarReturn(position: JournalCalendarReturn | null | undefined,
  entries: readonly Pick<JournalEntry, "id" | "date">[]): JournalCalendarReturn | null {
  if (!position || position.scope !== localJournalScopeGeneration() || !isValidIsoDate(position.date)
    || !Number.isFinite(position.scroll) || position.scroll < 0 || !position.entryId
    || !entries.some(entry => entry.id === position.entryId && entry.date === position.date)) return null
  return { scope: position.scope, date: position.date, entryId: position.entryId, scroll: position.scroll }
}

/** The date remains mounted after a portaled day-summary opener is removed. */
export function captureCalendarReaderPosition(region: HTMLElement | null, date: string): ReaderPosition {
  return { scope: localJournalScopeGeneration(), scroll: region?.scrollTop ?? 0,
    focusDate: isValidIsoDate(date) ? date : null, focusId: null, focusLabel: null, focusText: null }
}

export function captureReaderPosition(region: HTMLElement | null, opener?: HTMLElement): ReaderPosition {
  const candidate = opener ?? document.activeElement
  const active = candidate instanceof HTMLElement
    && region?.contains(candidate) && candidate.matches("button, a, select") ? candidate : null
  return { scope: localJournalScopeGeneration(), scroll: region?.scrollTop ?? 0,
    focusId: active?.id || null, focusDate: isValidIsoDate(active?.dataset.date ?? "") ? active!.dataset.date! : null,
    focusLabel: active?.getAttribute("aria-label") ?? null,
    focusText: active?.textContent?.trim() ?? null }
}

export function restoreReaderPosition(region: HTMLElement | null, position: ReaderPosition | null): void {
  if (!region || !position || position.scope !== localJournalScopeGeneration()) return
  region.scrollTop = position.scroll
  const controls = [...region.querySelectorAll<HTMLElement>("button, a, select")]
  const target = (position.focusDate ? controls.find(item => item.dataset.date === position.focusDate) : undefined)
    ?? (position.focusId ? controls.find(item => item.id === position.focusId) : undefined)
    ?? (position.focusLabel ? controls.find(item => item.getAttribute("aria-label") === position.focusLabel) : undefined)
    ?? (position.focusText ? controls.find(item => item.textContent?.trim() === position.focusText) : undefined)
  const focus = target ?? region.querySelector<HTMLElement>("h1, h2, [role='heading']")
  if (focus) { if (!target) focus.tabIndex = -1; focus.focus({ preventScroll: true }) }
}
