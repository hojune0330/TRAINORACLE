import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { ImportedActivity } from "../../domain/import/activity-file"
import { buildFileObservation, toFileObservationSummary, type FileObservationV1 } from "../../domain/import/file-observation"

type Meaning = NonNullable<FileObservationV1["confirmation"]>["durationMeaning"]
type Sport = FileObservationV1["sport"]

export function FileObservationReview({ activity, disabled, onChange, allowDateChange = true }: {
  readonly activity: ImportedActivity
  readonly disabled: boolean
  readonly onChange: (activity: ImportedActivity) => void
  readonly allowDateChange?: boolean
}) {
  const observation = activity.observation
  if (!observation) return null
  const confirmation = observation.confirmation ?? { durationMeaning: null, sport: null }
  const changeConfirmation = (patch: Partial<typeof confirmation>) => {
    const next = { ...observation, confirmation: { ...confirmation, ...patch } }
    onChange({ ...activity, observation: next, ...toFileObservationSummary(next) })
  }
  const zones = [...new Set([observation.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, "Asia/Seoul", "UTC"].filter((value): value is string => Boolean(value)))]
  const changeZone = (timeZone: string) => {
    if (!observation.startedAt) return
    const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(observation.startedAt))
    const part = (type: string) => parts.find(value => value.type === type)?.value
    const date = `${part("year")}-${part("month")}-${part("day")}`
    const { schemaVersion: _version, source: _source, sourceObservationKey: _key,
      contentRevisionFingerprint: _fingerprint, completeness: _completeness,
      sourceIdentityFingerprint: _identity, ...input } = observation
    const next = buildFileObservation({ ...input, date, timeZone })
    onChange({ ...activity, date, observation: next, ...toFileObservationSummary(next) })
  }
  return <div className="file-observation-review">
    <p>{observation.laps.length}개 구간 · {observation.sport === "RUNNING" ? "달리기" : observation.sport === "WALKING" ? "걷기" : observation.sport === "CYCLING" ? "자전거" : "운동 종류 확인 필요"}</p>
    <InfoDisclosure title="시간과 날짜 확인">
      {observation.durationMeaning === "SOURCE_DEFINED" || observation.durationMeaning === "UNKNOWN" ? <label>파일의 시간은 어떤 시간인가요?
        <select disabled={disabled} value={confirmation.durationMeaning ?? ""}
          onChange={event => changeConfirmation({ durationMeaning: (event.target.value || null) as Meaning })}>
          <option value="">모름 · 시간별 분석은 보류</option>
          <option value="TIMER">워치가 기록한 시간 · 일시정지 제외</option>
          <option value="MOVING">실제로 이동한 시간</option>
          <option value="ELAPSED">시작부터 끝까지 · 멈춘 시간 포함</option>
        </select>
      </label> : <p>파일에 지정된 시간: {observation.durationMeaning === "TIMER" ? "워치가 기록한 시간 · 일시정지 제외" : observation.durationMeaning === "MOVING" ? "실제로 이동한 시간" : "시작부터 끝까지 · 멈춘 시간 포함"}</p>}
      <p>원본 앱의 항목을 확인할 수 있을 때만 골라 주세요. 모르면 그대로 저장해도 거리와 구간은 확인할 수 있어요.</p>
      {(observation.sport === "UNKNOWN" || observation.sport === "OTHER") && <label>운동 종류
        <select disabled={disabled} value={confirmation.sport ?? ""}
          onChange={event => changeConfirmation({ sport: (event.target.value || null) as Sport | null })}>
          <option value="">확인하지 않음</option><option value="RUNNING">달리기</option>
          <option value="WALKING">걷기</option><option value="CYCLING">자전거</option><option value="OTHER">그 밖의 운동</option>
        </select>
      </label>}
      {observation.startedAt && allowDateChange ? <label>운동 날짜 기준 · {activity.date}
        <select disabled={disabled} value={observation.timeZone ?? zones[0]} onChange={event => changeZone(event.target.value)}>
          {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label> : !observation.startedAt ? <p>원본에 정확한 시각·시간대가 없어 파일의 날짜만 보관해요. 하루 안의 운동 순서는 판단하지 않아요.</p> : <p>저장된 날짜: {activity.date} · {observation.timeZone ?? "시간대 미확인"}</p>}
      {(observation.completeness.missingDistanceLaps > 0 || observation.completeness.missingDurationLaps > 0) &&
        <p>일부 구간의 수치가 없어요. 없는 값을 0으로 채우거나 일부 합계를 전체 기록으로 표시하지 않아요.</p>}
    </InfoDisclosure>
  </div>
}
