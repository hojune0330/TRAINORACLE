import { ChevronRight } from "lucide-react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { JournalEntry } from "../../domain/journal-schema"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { compactDate } from "../../domain/dates"
import { DailyContextTags } from "../home/DailyContextTags"
import { FatigueExperimentPanel } from "./FatigueExperimentPanel"
import "./recovery-record.css"

export function RecoveryRecordPanel({ today, entries, observations, onWriteRecovery, onOpenDay, experimentalFatigue }: {
  readonly today: string
  readonly entries: readonly JournalEntry[]
  readonly observations: readonly StructuredJournalObservation[]
  readonly onWriteRecovery?: (() => void) | undefined
  readonly onOpenDay?: ((date: string, entryId?: string) => void) | undefined
  readonly experimentalFatigue: boolean
}) {
  const session = observations.filter(item => item.loggedOn <= today && item.rpe !== null && item.fieldProvenance.rpe === "EXPLICIT")
    .sort((a, b) => b.loggedOn.localeCompare(a.loggedOn) || (b.sourceRef.observedAt ?? "").localeCompare(a.sourceRef.observedAt ?? ""))[0]
  const source = session ? entries.find(item => item.id === session.sourceRef.sourceId) : undefined
  const slot = source?.kind === "post-session" ? source.activitySlot === "AM" ? " · 오전" : source.activitySlot === "PM" ? " · 오후" : "" : ""
  return <section className="recovery-record" aria-label="몸 상태와 회복 기록">
    <h2>몸 상태·회복</h2>
    <InfoDisclosure purpose="actions" title="오늘 몸 상태 남기기" preview="가벼움 · 보통 · 피곤">
      <DailyContextTags date={today} bodyOnly />
      <p>오늘 상태는 이 기기에만 남아요. 운동의 힘든 정도·통증은 따로 기록해요.</p>
    </InfoDisclosure>
    {onWriteRecovery && <button className="recovery-record__action" type="button" onClick={onWriteRecovery}><span>수면·통증·기분 남기기</span><ChevronRight size={18} aria-hidden="true" /></button>}
    {session && <div className="recovery-record__last">
      <span>최근 운동 · 힘든 정도 {session.rpe}/10</span>
      <small>{compactDate(session.loggedOn)}{slot}</small>
      {onOpenDay && <button type="button" onClick={() => onOpenDay(session.loggedOn, session.sourceRef.sourceId)}>이 기록 보기<ChevronRight size={16} aria-hidden="true" /></button>}
    </div>}
    {experimentalFatigue && <InfoDisclosure purpose="actions" title="피로도 항목별 기록 · 실험" preview="기존 다섯 항목과 입력값 평균">
      <FatigueExperimentPanel />
    </InfoDisclosure>}
  </section>
}
