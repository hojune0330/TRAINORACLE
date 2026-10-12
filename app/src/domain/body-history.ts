import { BODY_PARTS } from "../components/body-parts"
import { isValidIsoDate } from "./dates"
import { parseBodyPartMetadata, type OtherBodyPartId } from "./body-part-metadata"
import type { JournalEntry } from "./journal-schema"

export type FixedBodyPartId = (typeof BODY_PARTS)[number]["id"]
export type BodyHistoryPartKind = "FIXED" | "OTHER" | "LEGACY_OTHER"
export type BodyHistorySource = "post-session" | "evening"

export type BodyHistoryRecord = {
  readonly key: string
  readonly entryId: string
  readonly date: string
  readonly savedAt: string
  readonly source: BodyHistorySource
  readonly severity: number
  readonly labelSnapshot?: string
  readonly note?: string
}

export type BodyHistoryPart = {
  readonly id: string
  readonly kind: BodyHistoryPartKind
  readonly label: string
  readonly lastRecordedDate: string
  readonly records: readonly BodyHistoryRecord[]
}

export type BodyHistoryProjection = {
  readonly parts: readonly BodyHistoryPart[]
}

type PendingRecord = {
  readonly record: BodyHistoryRecord
  readonly order: number
}

type MutablePart = {
  readonly id: string
  readonly kind: BodyHistoryPartKind
  readonly fixedLabel?: string
  readonly pendingRecords: PendingRecord[]
  readonly order: number
}

function sourceOf(entry: JournalEntry): BodyHistorySource | null {
  return entry.kind === "post-session" || entry.kind === "evening" ? entry.kind : null
}

function painPartsOf(entry: JournalEntry): Readonly<Record<string, number>> {
  if (entry.kind === "post-session") return entry.painParts ?? {}
  if (entry.kind === "evening") return entry.painParts
  return {}
}

function validSeverity(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 5
}

function compareNewestFirst(left: PendingRecord, right: PendingRecord): number {
  const byDate = right.record.date.localeCompare(left.record.date)
  if (byDate !== 0) return byDate

  const leftSavedAt = Date.parse(left.record.savedAt)
  const rightSavedAt = Date.parse(right.record.savedAt)
  if (Number.isFinite(leftSavedAt) && Number.isFinite(rightSavedAt) && leftSavedAt !== rightSavedAt) {
    return rightSavedAt - leftSavedAt
  }
  return right.order - left.order
}

function fixedPartForKey(key: string): (typeof BODY_PARTS)[number] | undefined {
  return BODY_PARTS.find(part => part.id === key || part.name === key)
}

function createMutablePart(
  parts: Map<string, MutablePart>,
  id: string,
  kind: BodyHistoryPartKind,
  order: number,
  fixedLabel?: string,
): MutablePart {
  let part = parts.get(id)
  if (!part) {
    part = { id, kind, fixedLabel, pendingRecords: [], order }
    parts.set(id, part)
  }
  return part
}

/**
 * Read-only projection of current owner-filtered journal entries.
 * Every source row stays separate; empty maps and absent dates never become
 * zero-valued events. Free labels and notes are read only from validated
 * private body metadata.
 */
export function projectBodyHistory(entries: readonly JournalEntry[]): BodyHistoryProjection {
  const parts = new Map<string, MutablePart>()
  let order = 0

  for (const entry of entries) {
    const source = sourceOf(entry)
    if (source === null || !isValidIsoDate(entry.date)) continue

    const fixedObservations = painPartsOf(entry)
    let legacySequence = 0
    for (const [storedKey, severity] of Object.entries(fixedObservations)) {
      if (!validSeverity(severity)) continue

      const fixedPart = fixedPartForKey(storedKey)
      const partId = fixedPart?.id ?? "legacy-other"
      const partKind: BodyHistoryPartKind = fixedPart ? "FIXED" : "LEGACY_OTHER"
      const part = createMutablePart(
        parts,
        partId,
        partKind,
        fixedPart ? BODY_PARTS.indexOf(fixedPart) : BODY_PARTS.length,
        fixedPart?.name ?? "기타 부위",
      )
      legacySequence += fixedPart ? 0 : 1
      part.pendingRecords.push({
        order: order++,
        record: {
          key: entry.id + ":" + partId + ":" + legacySequence,
          entryId: entry.id,
          date: entry.date,
          savedAt: entry.savedAt,
          source,
          severity,
        },
      })
    }

    const metadata = parseBodyPartMetadata(entry.bodyPartMetadata)
    if (metadata === null || entry.kind === "race") continue
    for (const observation of metadata.observations) {
      const part = createMutablePart(parts, observation.id, "OTHER", BODY_PARTS.length + order)
      part.pendingRecords.push({
        order: order++,
        record: {
          key: entry.id + ":" + observation.id,
          entryId: entry.id,
          date: entry.date,
          savedAt: entry.savedAt,
          source,
          severity: observation.severity,
          labelSnapshot: observation.labelSnapshot,
          ...(observation.note === undefined ? {} : { note: observation.note }),
        },
      })
    }
  }

  const projected = [...parts.values()].map((part): BodyHistoryPart => {
    const records = [...part.pendingRecords].sort(compareNewestFirst).map(({ record }) => record)
    const latestCustomLabel = records.find(record => record.labelSnapshot !== undefined)?.labelSnapshot
    return {
      id: part.id,
      kind: part.kind,
      label: part.fixedLabel ?? latestCustomLabel ?? "기타 부위",
      lastRecordedDate: records[0]?.date ?? "",
      records,
    }
  })

  projected.sort((left, right) => {
    const byDate = right.lastRecordedDate.localeCompare(left.lastRecordedDate)
    if (byDate !== 0) return byDate
    const leftOrder = parts.get(left.id)?.order ?? 0
    const rightOrder = parts.get(right.id)?.order ?? 0
    return leftOrder - rightOrder
  })

  return { parts: projected }
}

/** Latest saved name per stable custom ID, derived from visible source entries. */
export function recentCustomBodyParts(
  entries: readonly JournalEntry[],
): readonly { readonly id: OtherBodyPartId; readonly labelSnapshot: string }[] {
  return projectBodyHistory(entries).parts
    .filter(part => part.kind === "OTHER")
    .map(part => ({ id: part.id as OtherBodyPartId, labelSnapshot: part.label }))
}
