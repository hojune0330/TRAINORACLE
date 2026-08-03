export type JournalReaderProjection = {
  readonly dates: readonly string[]
  readonly currentIndex: number
  readonly previousDate: string | null
  readonly nextDate: string | null
  readonly position: number
  readonly total: number
}

export function projectJournalReader(
  entries: readonly { readonly date: string }[],
  currentDate: string,
): JournalReaderProjection {
  const dates = [...new Set(entries.map((entry) => entry.date))].sort()
  const currentIndex = dates.indexOf(currentDate)

  return Object.freeze({
    dates: Object.freeze(dates),
    currentIndex,
    previousDate: currentIndex > 0 ? dates[currentIndex - 1] ?? null : null,
    nextDate: currentIndex >= 0 && currentIndex < dates.length - 1
      ? dates[currentIndex + 1] ?? null
      : null,
    position: currentIndex >= 0 ? currentIndex + 1 : 0,
    total: dates.length,
  })
}
