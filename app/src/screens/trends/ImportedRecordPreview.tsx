import { ChevronRight } from "lucide-react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { compactDate } from "../../domain/dates"
import { hasImportedField, isImportedField } from "../../domain/field-provenance"
import type { JournalEntry } from "../../domain/journal-schema"
import { parseDistanceKm, parseDurationMin } from "../../domain/numeric-input"
import { paceClock } from "../../domain/pace-tools"
import "./imported-record-preview.css"

export function ImportedRecordPreview({ entries, today, onOpenDay }: {
  readonly entries: readonly JournalEntry[]
  readonly today: string
  readonly onOpenDay?: ((date: string, entryId?: string) => void) | undefined
}) {
  const imported = entries.filter(entry => entry.kind === "post-session" && entry.date <= today
    && (entry.fileObservation || hasImportedField(entry.fieldProvenance)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))
  const entry = imported[0]
  if (!entry || entry.kind !== "post-session") return null
  const file = entry.fileObservation
  const distance = file ? file.distanceMeters === null ? null : file.distanceMeters / 1000
    : isImportedField("distanceKm", entry.fieldProvenance) ? parseDistanceKm(entry.distanceKm) : null
  const duration = file ? file.durationSeconds
    : isImportedField("durationMin", entry.fieldProvenance) ? (parseDurationMin(entry.durationMin) ?? NaN) * 60 : null
  const meaning = file?.confirmation?.durationMeaning ?? file?.durationMeaning
  const durationLabel = meaning === "ELAPSED" ? "전체 경과 시간" : meaning === "MOVING" ? "이동 시간"
    : meaning === "TIMER" ? "타이머 시간" : "파일의 시간 · 종류 미확인"
  return <section className="trends-record-reading imported-record-preview" aria-label="가져온 운동 기록 미리보기">
    <div><p>가져온 기록 {imported.length}개 · 최근 운동</p><h2>{compactDate(entry.date)}</h2>
      <dl><dt>거리</dt><dd>{distance === null ? "파일에 없음" : `${distance}km`}</dd>
        <dt>{durationLabel}</dt><dd>{duration === null || !Number.isFinite(duration) ? "파일에 없음" : paceClock(duration)}</dd></dl>
    </div>
      {onOpenDay && <button type="button" onClick={() => onOpenDay(entry.date, entry.id)}>가져온 일지 보기<ChevronRight size={18} aria-hidden="true" /></button>}
      <InfoDisclosure title="미리보기와 분석은 어떻게 다른가요?">
        <p>이 값은 저장한 파일 기록을 그대로 보여줘요. 평균 페이스·훈련 강도·최고기록은 새로 추정하지 않아요.</p>
        <p>계정 확인과 분석 기준을 통과한 항목만 그래프에 들어가요. 시간 종류를 모르면 다른 운동의 시간과 비교하지 않아요.</p>
      </InfoDisclosure>
  </section>
}
