import { useId } from "react"
import { AppHeading } from "../../components/AppHeading"
import { RecordAction } from "../../components/RecordUI"
import type { JournalEntry } from "../../domain/journal-schema"
import { connectedWeeklyFacts, type WeeklyFactPeriod } from "../../domain/connected-weekly-facts"
import { activityDuration } from "../../components/ImportedActivityMetrics"

const clockLabel = { TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "전체 경과 시간" } as const
const number = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)
export function ConnectedWeeklyFacts({ entries, today, onOpenDay }: {
  entries: readonly JournalEntry[]; today: string; onOpenDay?: (date: string, id?: string) => void
}) {
  const titleId = useId()
  const facts = connectedWeeklyFacts(entries, today)
  if (!facts || (!facts.current.records.length && !facts.previous.records.length
    && !facts.current.conflictingIds && !facts.previous.conflictingIds)) return null
  const { current, previous } = facts
  const groups = [...new Set([...current.groups, ...previous.groups].map(group => group.id))]
  const latest = current.records[0]
  const records = (period: WeeklyFactPeriod, label: string) => <section className="home-weekly__period" aria-label={label + " 근거 기록"}>
    <h3>{label} · {period.records.length}개</h3>
    <p>{period.start} ~ {period.end}</p>
    <p>거리 비교 제외 {period.excludedDistance}개 · 시간 비교 제외 {period.excludedTime}개</p>
    {period.conflictingIds > 0 && <p>서로 다른 수정본 {period.conflictingIds}개는 제외했어요.</p>}
    {period.duplicateCopies > 0 && <p>같은 기록의 사본 {period.duplicateCopies}개는 합계에서 한 번만 셌어요.</p>}
    {period.records.length === 0 ? <p>이 기간에 확인할 운동 기록이 없어요.</p> :
      <ul>{period.records.map(record => <li key={record.id}>{onOpenDay
        ? <button type="button" onClick={() => onOpenDay(record.date, record.id)}
          aria-label={label + " " + record.date + " 운동 일지 열기"}>
          <span>{record.date}</span><span>{record.source === "IMPORTED" ? "가져온 기록" : "직접 기록"} · 일지 열기</span>
        </button>
        : <span>{record.date} · {record.source === "IMPORTED" ? "가져온 기록" : "직접 기록"}</span>}</li>)}</ul>}
  </section>
  return <section className="home-weekly" aria-labelledby={titleId}>
    <AppHeading as="h2" variant="section" id={titleId}>이번 주 운동 기록</AppHeading>
    <p>지난주 같은 요일까지, 내 일지에 저장된 기록을 비교해요.</p>
    <div className="home-weekly__counts">
      <div><span>이번 주</span><strong>{current.records.length}<small>개</small></strong><span>{current.start} ~ {current.end}</span></div>
      <div><span>지난주 같은 기간</span><strong>{previous.records.length}<small>개</small></strong><span>{previous.start} ~ {previous.end}</span></div>
    </div>
    {groups.length > 0 && <dl className="home-weekly__facts">{groups.map(id => {
      const a = current.groups.find(group => group.id === id), b = previous.groups.find(group => group.id === id)
      const clocks = [...new Set([...(a?.times ?? []), ...(b?.times ?? [])].map(time => time.clock))]
      return <div key={id}><dt>{(a ?? b)!.label}</dt><dd>
        <span>거리 · 이번 주 {a?.distanceKm == null ? "비교할 값 없음" : number(a.distanceKm) + " km (" + a.distanceSamples + "개)"}
          {" / 지난주 "}{b?.distanceKm == null ? "비교할 값 없음" : number(b.distanceKm) + " km (" + b.distanceSamples + "개)"}</span>
        {clocks.map(clock => {
          const left = a?.times.find(time => time.clock === clock), right = b?.times.find(time => time.clock === clock)
          return <span key={clock}>{clockLabel[clock]} · 이번 주 {left ? activityDuration(left.seconds) + " (" + left.samples + "개)" : "비교할 값 없음"}
            {" / 지난주 "}{right ? activityDuration(right.seconds) + " (" + right.samples + "개)" : "비교할 값 없음"}</span>
        })}
      </dd></div>
    })}</dl>}
    <p className="home-weekly__coverage">미수신·미기록 운동은 포함하지 않아요. 거리와 시간은 출처·종목·시간 기준을 확인한 값만 비교해요.</p>
    {(current.excludedDistance > 0 || previous.excludedDistance > 0 || current.excludedTime > 0 || previous.excludedTime > 0) &&
      <p className="home-weekly__coverage">값이 없거나 비교 기준이 확인되지 않은 기록은 합계에서 제외했어요. 직접 적은 시간은 타이머·이동 시간과 합치지 않아요.</p>}
    <details><summary>비교에 사용한 기록과 제외 내역</summary>{records(current, "이번 주")}{records(previous, "지난주")}</details>
    {latest && onOpenDay && <RecordAction priority="secondary" onClick={() => onOpenDay(latest.date, latest.id)}>최근 운동 일지에서 돌아보기</RecordAction>}
  </section>
}
