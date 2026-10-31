import { useId, useState } from "react"
import type { FileObservationV1 } from "../domain/import/file-observation"
import { fileDuration, fileNumber } from "../screens/trends/file-analysis-display"
import { RecordAction, RecordNotice, RecordSource } from "./RecordUI"
import "./imported-activity-detail.css"

const SPORT: Record<FileObservationV1["sport"], string> = {
  RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "그 밖의 운동", UNKNOWN: "종류 미확인",
}
const TIME: Record<FileObservationV1["durationMeaning"], string> = {
  TIMER: "타이머 시간 · 일시정지 제외", MOVING: "이동 시간", ELAPSED: "전체 경과 시간 · 멈춘 시간 포함",
  SOURCE_DEFINED: "파일 시간 · 종류 미지정", UNKNOWN: "시간 종류 미확인",
}
const LAP_TIME: Record<FileObservationV1["durationMeaning"], string> = {
  TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "전체 경과 시간",
  SOURCE_DEFINED: "종류 미지정", UNKNOWN: "종류 미확인",
}
const LAP_KIND = { WORK: "운동", RECOVERY: "회복", UNKNOWN: "종류 미지정" } as const
const ORIGIN: Record<NonNullable<FileObservationV1["dataLineage"]>["sources"][number]["originProvider"], string> = {
  GARMIN: "Garmin", COROS: "COROS", APPLE: "Apple", SAMSUNG: "Samsung", WHOOP: "WHOOP",
  USER: "사용자", OTHER: "기타 원천", UNKNOWN: "원천 미확인",
}
const PAGE_SIZE = 20

/** Keep the file's clock and offset; never reinterpret it in the viewing device's zone. */
function sourceClock(startedAt: string): string {
  return startedAt.replace("T", " ").replace(/(Z|[+-]\d{2}:\d{2})$/, (_, offset: string) =>
    ` UTC${offset === "Z" ? "+00:00" : offset}`)
}

function OriginalLaps({ observation }: { readonly observation: FileObservationV1 }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const tableId = useId()
  const { laps, completeness } = observation
  if (laps.length === 0) return <RecordNotice kind="empty" title="구간 기록이 없어요">
    <p>구간별 거리와 시간을 표시할 자료가 없어요.</p>
  </RecordNotice>
  const shown = Math.min(limit, laps.length)
  const remaining = laps.length - shown
  const confirmedMeaning = observation.confirmation?.durationMeaning
  return <div className="imported-activity-detail__laps">
    <h4>구간 {laps.length}개</h4>
    <p>파일에 담긴 순서와 구간 종류예요.</p>
    {confirmedMeaning && laps.some(lap => lap.durationMeaning !== confirmedMeaning)
      && <p>전체 시간에 고른 기준과 구간 원본의 시간 종류는 따로 표시해요.</p>}
    {(completeness.missingDistanceLaps > 0 || completeness.missingDurationLaps > 0) && <p className="imported-activity-detail__missing">
      {[completeness.missingDistanceLaps > 0 ? `거리 미기록 ${completeness.missingDistanceLaps}개` : null,
        completeness.missingDurationLaps > 0 ? `시간 미기록 ${completeness.missingDurationLaps}개` : null].filter(Boolean).join(" · ")}
      <br />미기록 항목은 0이나 일부 구간의 합계로 채우지 않아요.
    </p>}
    <table id={tableId} className="imported-activity-detail__table">
      <caption>파일의 구간 기록 · 원본 순서</caption>
      <colgroup><col className="imported-activity-detail__lap-column" /><col className="imported-activity-detail__distance-column" /><col /></colgroup>
      <thead><tr><th scope="col">구간 · 종류</th><th scope="col">거리</th><th scope="col">원본 시간</th></tr></thead>
      <tbody>{laps.slice(0, shown).map(lap => <tr key={lap.sourceIndex}>
        <th scope="row"><span>{lap.sourceIndex + 1}</span><small>{LAP_KIND[lap.kind]}</small></th>
        <td><span className="imported-activity-detail__value">{lap.distanceMeters === null ? "미기록" : `${fileNumber(lap.distanceMeters)}m`}</span></td>
        <td><span className="imported-activity-detail__value">{fileDuration(lap.durationSeconds)}</span><small>{LAP_TIME[lap.durationMeaning]}</small></td>
      </tr>)}</tbody>
    </table>
    <p className="imported-activity-detail__page" aria-live="polite">전체 {laps.length}개 중 {shown}개 표시</p>
    {remaining > 0 && <RecordAction priority="secondary" aria-controls={tableId}
      onClick={() => setLimit(previous => Math.min(previous + PAGE_SIZE, laps.length))}>
      구간 {Math.min(PAGE_SIZE, remaining)}개 더 보기
    </RecordAction>}
  </div>
}

/** Stored file facts only. Reading never saves, confirms, or grants analysis permission. */
export function ImportedActivityDetail({ observation }: { readonly observation: FileObservationV1 }) {
  const titleId = useId()
  const confirmedMeaning = observation.confirmation?.durationMeaning
  const effectiveMeaning = confirmedMeaning ?? observation.durationMeaning
  const confirmedSport = observation.confirmation?.sport
  const origins = observation.dataLineage
    ? [...new Set(observation.dataLineage.sources.map(source => ORIGIN[source.originProvider]))].join(" · ")
    : "원천 미확인"
  return <section className="imported-activity-detail record-ui" aria-labelledby={titleId}>
    <h3 id={titleId}>파일 기록 상세</h3>
    <RecordSource source="파일에서 가져옴" format={observation.format.toUpperCase()}
      dateBasis={observation.timeZone ?? "지역 시간대 미확인 · 파일 날짜 유지"}
      originalTimeMeaning={TIME[observation.durationMeaning]}
      {...(confirmedMeaning ? { confirmedTimeMeaning: TIME[confirmedMeaning] } : {})} />
    <dl className="imported-activity-detail__context">
      <div><dt>표기된 원천</dt><dd>{origins}</dd></div>
      <div><dt>일지 날짜</dt><dd><time dateTime={observation.date}>{observation.date}</time></dd></div>
      <div><dt>파일의 운동 시작</dt><dd>{observation.startedAt
        ? <time dateTime={observation.startedAt}>{sourceClock(observation.startedAt)}</time>
        : "정확한 시작 시각 미기록"}</dd></div>
      <div><dt>파일의 운동 종류</dt><dd>{SPORT[observation.sport]}</dd></div>
      {confirmedSport && <div><dt>내가 확인한 운동</dt><dd>{SPORT[confirmedSport]}</dd></div>}
    </dl>
    {observation.dataLineage && <p>원천은 기록에 저장된 표기이며, 제공자 인증 여부를 뜻하지 않아요.</p>}
    {(effectiveMeaning === "SOURCE_DEFINED" || effectiveMeaning === "UNKNOWN") && <p>
      시간 종류가 미확정이라 시간 비교와 페이스 계산은 보류해요.
    </p>}
    <OriginalLaps key={`${observation.sourceObservationKey}:${observation.contentRevisionFingerprint}`} observation={observation} />
  </section>
}
