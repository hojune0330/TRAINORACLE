import React from "react"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { canonicalPaceDistance, formatPaceSeconds } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "../../domain/athlete-records"
import { prepareInitialRecordPaces } from "../../domain/initial-record-pace"
import { todayISO } from "../../domain/journal-store"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { ACCOUNT_ATHLETE_RECORD_EVENT } from "../../domain/account/account-athlete-record-service"
import { readEligibleAccountPaceRecords } from "../../domain/account/eligible-account-pace-records"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { derivePaceRecordOptions } from "../../domain/pace-record-options"

export function InitialRecordPaceOffer({ generated, records, disabled, onChange }: {
  generated: PlanGenerationSuccess; records: readonly AthleteRecord[]; disabled: boolean; onChange: (value: PlanGenerationSuccess) => void;
}) {
  const scope = React.useRef(localAccountScopeSnapshot()).current
  const [, refreshSource] = React.useReducer((revision: number) => revision + 1, 0)
  React.useEffect(() => {
    window.addEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, refreshSource)
    const stop = onLocalJournalScopeChange(refreshSource)
    return () => { stop(); window.removeEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, refreshSource) }
  }, [])
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | undefined>()
  const available = readEligibleAccountPaceRecords(records)
  const event = canonicalPaceDistance(generated.candidates[0].eventDistanceM)
  const referenceEvent = [10000, 21097.5, 42195].includes(event) ? event : 5000
  const options = derivePaceRecordOptions(available, referenceEvent, todayISO()).options
  const offer = localAccountScopeIsCurrent(scope)
    ? prepareInitialRecordPaces(generated, available, todayISO(), selectedRecordId) : null
  const [message, setMessage] = React.useState("")
  if (!offer && !options.length) return null
  const compatible = generated.candidates[0].sessions.some(session => session.role === "QUALITY"
    && session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout
    && (["LT_INTENT", "VO2_INTENT"].includes(session.plannedEnergyIntent)
      || session.plannedEnergyIntent === "MIXED_INTENT" && [10000, 21097.5, 42195].includes(event)))
  if (!compatible) return null
  const eventLabel = (distance: number) => canonicalPaceDistance(distance) === 21097.5 ? "하프" : distance === 42195 ? "마라톤" : distance >= 10000 ? `${distance / 1000}km` : `${distance}m`
  const minutes = (range: { minimum: number; maximum: number }) => {
    const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 })
    return range.minimum === range.maximum ? `${number.format(range.minimum)}분` : `${number.format(range.minimum)}~${number.format(range.maximum)}분`
  }
  return <section aria-label="최근 기록으로 페이스 추천">
    {offer ? offer.records.map(record => <p key={record.id}>{eventLabel(record.eventDistanceM)} {record.purpose === "RACE_GOAL" ? "목표기록" : "경기 기록"} {formatPaceSeconds(record.performanceSeconds)} · {record.achievedOn ?? (record.purpose === "RACE_GOAL" ? "현재 능력과 달라요" : "날짜 미입력")}</p>)
      : <p>사용할 경기 기록을 골라 주세요.</p>}
    <details><summary>기준 바꾸기</summary><label>기준 기록<select value={selectedRecordId ?? ""} disabled={disabled} onChange={event => {
      setSelectedRecordId(event.target.value || undefined); setMessage("")
    }}><option value="">최근 실제 경기 우선</option>{options.map(option => <option key={option.sourceSnapshot.id} value={option.sourceSnapshot.id}>
      {formatPaceSeconds(option.sourceSnapshot.performanceSeconds)} · {option.sourceSnapshot.purpose === "RACE_GOAL" ? "목표" : option.sourceSnapshot.achievedOn ?? "날짜 미입력"}
    </option>)}</select></label></details>
    {offer?.durationChanges.length ? <div aria-label="총 훈련시간 변경 미리보기">
      {offer.longerDuration && <p>준비·회복을 포함한 시간이 늘어나요. 변경할 시간을 확인해 주세요.</p>}
      <ul>{offer.durationChanges.map(change => <li key={`${change.day}:${change.slot}`}>
        {change.day}일차 {change.slot === "AM" ? "오전" : "오후"}: {minutes(change.before)} → {minutes(change.after)}
      </li>)}</ul>
    </div> : null}
    {selectedRecordId && !offer && <p role="status">이 기록은 현재 훈련 구성에 적용할 수 없어요. 기존 계획은 그대로예요.</p>}
    <button type="button" disabled={disabled || !offer} onClick={() => {
      if (!localAccountScopeIsCurrent(scope)) { setMessage("계정이 바뀌었어요. 계획을 다시 열어 주세요."); return }
      const fresh = prepareInitialRecordPaces(generated, readEligibleAccountPaceRecords(), todayISO(), selectedRecordId)
      if (!fresh || !offer || JSON.stringify(fresh.records) !== JSON.stringify(offer.records)) {
        setMessage("경기 기록이 바뀌었어요. 최신 기록을 다시 확인해 주세요."); return
      }
      onChange(fresh.generated)
    }}>이 기록으로 목표 페이스 보기</button>
    {message && <p role="status">{message}</p>}
  </section>
}
