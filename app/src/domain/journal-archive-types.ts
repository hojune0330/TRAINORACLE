export type ArchiveSelection = {
  readonly selectedMonth: string | null
  readonly selectedWeekStart: string | null
}

export type ArchiveKindCounts = {
  readonly postSession: number
  readonly evening: number
  readonly race: number
}

export type ArchiveMetrics = {
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly moodAverage: number | null
  readonly painMax: number | null
}

export type ArchiveDaySummary = {
  readonly date: string
  readonly entryCount: number
  readonly kindCounts: ArchiveKindCounts
  readonly metrics: ArchiveMetrics
  readonly excludedRecordCount: number
}

export type ArchiveWeekSummary = {
  readonly weekStart: string
  readonly weekEnd: string
  readonly entryCount: number
  readonly kindCounts: ArchiveKindCounts
  readonly metrics: ArchiveMetrics
  readonly excludedRecordCount: number
  readonly days: readonly ArchiveDaySummary[]
}

export type ArchiveMonthSummary = {
  readonly month: string
  readonly entryCount: number
  readonly kindCounts: ArchiveKindCounts
  readonly metrics: ArchiveMetrics
  readonly excludedRecordCount: number
  readonly weeks: readonly ArchiveWeekSummary[]
}

export type JournalArchiveProjection = {
  readonly months: readonly ArchiveMonthSummary[]
}
