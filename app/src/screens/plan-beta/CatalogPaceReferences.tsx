import { formatPaceSeconds, canonicalPaceDistance, PACE_EVENT_METERS, predictRaceFromActual, catalogRecordPaceModel, type SegmentPaceReference } from "@impl/prescription/record-pace"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { AthleteRecord } from "../../domain/athlete-records"
import { createSegmentRecordReference, recordPaceSegments } from "../../domain/catalog-pace-reference"
import { todayISO } from "../../domain/journal-store"
import { derivePaceRecordOptions, type PaceRecordSelectionBadge } from "../../domain/pace-record-options"

const badgeLabel: Record<PaceRecordSelectionBadge, string> = {
  RECENT_ACTUAL: "최근 경기", ROLLING_12_BEST: "최근 12개월 최고", LIFETIME_BEST: "입력된 개인 최고", GOAL: "목표",
}

export function CatalogPaceReferences({ catalogId, inputs, records, disabled, onChange }: {
  catalogId: string; inputs: WorkoutCalculationInputs; records: readonly AthleteRecord[]; disabled: boolean;
  onChange: (segmentId: string, value: SegmentPaceReference | null) => void;
}) {
  const segments = recordPaceSegments(catalogId, inputs)
  const available = records.filter(r => r.verificationState !== "UNVERIFIED"
    && PACE_EVENT_METERS.some(d => d === canonicalPaceDistance(r.eventDistanceM)))
  const groups = PACE_EVENT_METERS.map(event => derivePaceRecordOptions(available, event, todayISO()))
  if (!segments.length) return null
  return <details className="plan-detailed-options"><summary>기록으로 구간 페이스 정하기</summary>
    {segments.map(segment => {
      const selected = inputs.paceReferences?.find(r => r.segmentId === segment.segmentId)
      const eligibleGroups = groups.filter(group => catalogRecordPaceModel(segment.intent, group.eventDistanceM, segment.referenceEventDistanceM) !== null)
      const recommended = eligibleGroups.flatMap(group => available.filter(r => r.id === group.recommendedRecordId))[0]
      const choose = (record: AthleteRecord | undefined) => onChange(segment.segmentId, record
        ? createSegmentRecordReference(segment.segmentId, record, todayISO(), catalogRecordPaceModel(segment.intent, record.eventDistanceM, segment.referenceEventDistanceM)!) : null)
      return <div key={segment.segmentId}>
        <label>{segment.distanceM ? `${segment.distanceM}m` : `${segment.seconds?.minimum ?? ""}초`} 구간의 기준
          <select disabled={disabled} value={selected?.recordId ?? ""} onChange={e => {
            const record = available.find(r => r.id === e.target.value)
            choose(record)
          }}><option value="">현재 기준 유지</option>
            {selected && !available.some(r => r.id === selected.recordId) && <option value={selected.recordId}>저장된 기준 · 다시 확인 필요</option>}
            {eligibleGroups.flatMap(group => group.options.map(option => {
              const r = option.sourceSnapshot
              return <option key={r.id} value={r.id}>{group.eventDistanceM === 21097.5 ? "하프" : `${group.eventDistanceM}m`} · {formatPaceSeconds(r.performanceSeconds)} · {option.badges.map(b => badgeLabel[b]).join(" / ")} · {r.achievedOn ?? (r.purpose === "RACE_GOAL" ? "미래 목표" : "날짜 미입력")}</option>
            }))}
          </select>
        </label>
        {!selected && recommended && <button type="button" disabled={disabled} onClick={() => choose(recommended)}>최근 경기 {formatPaceSeconds(recommended.performanceSeconds)} 사용</button>}
        {selected && <p role="status">{selected.kind === "GOAL" ? "목표기록 기준이에요. 현재 경기력을 뜻하지 않아요." : selected.achievedOn === null ? "날짜 미입력 기록이에요. 최근 기록인지 확인해 주세요." : selected.model === "FIVE_K_THRESHOLD_V1" ? `${selected.achievedOn} 5km 기록에서 계산한 참고 범위예요. 측정한 개인 역치는 아니에요.` : `${selected.achievedOn} 경기의 평균 속도예요.`} 반복과 회복은 그대로예요.</p>}
      </div>
    })}
    {groups.some(group => group.latestStatus === "AMBIGUOUS" && segments.some(segment => catalogRecordPaceModel(segment.intent, group.eventDistanceM, segment.referenceEventDistanceM) !== null)) && <p>같은 날 서로 다른 기록이 있어요. 사용할 기록을 직접 골라 주세요.</p>}
    <details><summary>다른 종목의 예상 기록 보기</summary>
      <p>아래는 공식으로 비교한 값이며, 실제 기록이나 적용된 훈련 페이스가 아니에요.</p>
      {available.filter(r => r.purpose !== "RACE_GOAL").map(record => <details key={record.id}>
        <summary>{record.eventDistanceM}m · {formatPaceSeconds(record.performanceSeconds)} 기준</summary>
        <dl>{PACE_EVENT_METERS.flatMap(target => {
          const result = predictRaceFromActual({ kind: "ACTUAL", recordId: record.id, eventDistanceM: record.eventDistanceM,
            performanceSeconds: record.performanceSeconds }, target)
          return result ? [<div key={target}><dt>{target === 21097.5 ? "하프" : `${target}m`}</dt><dd>{formatPaceSeconds(result.seconds, 0)} · 예상<p>{result.limitation}</p></dd></div>] : []
        })}</dl><small>Riegel 1.06 · 비교용. 예상값을 실제 기록으로 저장하지 않아요.</small>
      </details>)}
    </details>
  </details>
}
