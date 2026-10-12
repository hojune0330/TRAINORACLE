import type { JournalEntry } from "../domain/journal-schema"
import { parseBodyPartMetadata } from "../domain/body-part-metadata"
import { bodyPartLabel } from "./body-parts"

/** Owner-only original journal display. Do not reuse in public/export previews. */
export function BodyRecordSummary({ entry }: { readonly entry: JournalEntry }) {
  if (entry.kind === "race") return null
  const fixed = Object.entries(entry.painParts ?? {}).filter(([, level]) => level > 0)
  const other = parseBodyPartMetadata(entry.bodyPartMetadata)?.observations ?? []
  if (fixed.length === 0 && other.length === 0) return null
  return <section aria-label="기록한 몸 상태" className="body-record-summary">
    <h3>몸 상태</h3>
    <ul>
      {fixed.map(([id, level]) => <li key={id}><strong>{bodyPartLabel(id)}</strong><span>{level}/5</span></li>)}
      {other.map(item => <li key={item.id}>
        <strong>{item.labelSnapshot}</strong><span>{item.severity}/5</span>
        {item.note?.trim() && <p>{item.note}</p>}
      </li>)}
    </ul>
  </section>
}
