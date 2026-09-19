import React from "react"
import { ArrowRight } from "lucide-react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { buildFileAnalysisReport, type FileAnalysisEntry, type FileAnalysisExclusion, type ProjectedFileObservation } from "../../domain/import/file-analysis"
import { fileAnalysisFormats } from "../../domain/import/file-analysis-policy"
import { todayISO } from "../../domain/journal-store"
import { FileObservationCorrection } from "./FileObservationCorrection"
import { FilePlanComparison } from "./FilePlanComparison"
import { fileDuration, fileNumber as number, filePace as pace } from "./file-analysis-display"
import "../import-activities/file-analysis.css"

const SPORT = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "그 밖의 운동", UNKNOWN: "종류 미확인" } as const
const MEANING = { TIMER: "기록 시간", MOVING: "이동 시간", ELAPSED: "전체 경과 시간", SOURCE_DEFINED: "뜻을 확인하지 않은 파일 시간", UNKNOWN: "뜻을 알 수 없는 시간" } as const
const REASON: Record<FileAnalysisExclusion, string> = {
  NOT_FILE_OBSERVATION: "정밀 파일 자료 없음", INVALID_FILE_OBSERVATION: "파일 자료 검증 필요", DATE_MISMATCH: "일지와 파일 날짜 불일치",
  CONFIRMATION_REQUIRED: "가져오기 확인 전", FORMAT_DISABLED: "이 형식의 분석 준비 중", ACCOUNT_CONFIRMATION_REQUIRED: "계정 저장 확인 전",
  CONFLICTING_SOURCE_KEY: "같은 운동의 서로 다른 기록 확인 필요", MISSING_DISTANCE: "거리 없음", MISSING_DURATION: "시간 없음",
  DIFFERENT_TIME_MEANING: "다른 종류의 시간", TIME_MEANING_UNCONFIRMED: "시간의 뜻 미확인", ZERO_DISTANCE: "거리 0", ZERO_DURATION: "시간 0", NON_FINITE_RESULT: "계산 가능한 범위 초과",
}
export { fileDuration } from "./file-analysis-display"

function ActivitySegments({ observation }: { readonly observation: ProjectedFileObservation }) {
  const [limit, setLimit] = React.useState(20)
  return <InfoDisclosure title={`${observation.date} · ${SPORT[observation.sport]} · ${observation.laps.length}개 구간`}>
    <p>거리 {observation.distanceMeters === null ? "미기록" : `${number(observation.distanceMeters / 1000)}km`} · {MEANING[observation.durationMeaning]} {fileDuration(observation.durationSeconds)}</p>
    <p>구간의 종류는 파일에 있는 그대로예요. 자동 랩을 본운동이나 휴식으로 추측하지 않아요.</p>
    <div className="file-analysis-table" role="region" aria-label={`${observation.date} 구간 기록`} tabIndex={0}>
      <table><caption>파일에 기록된 순서</caption><thead><tr><th scope="col">구간</th><th scope="col">종류</th><th scope="col">거리</th><th scope="col">시간</th></tr></thead>
        <tbody>{observation.laps.slice(0, limit).map(lap => <tr key={lap.sourceIndex}>
          <th scope="row">{lap.sourceIndex + 1}</th><td>{lap.kind === "WORK" ? "운동" : lap.kind === "RECOVERY" ? "회복" : "미지정"}</td>
          <td><span className="file-analysis-value">{lap.distanceMeters === null ? "미기록" : `${number(lap.distanceMeters)}m`}</span></td>
          <td><span className="file-analysis-value">{fileDuration(lap.durationSeconds)}</span><br /><small>{MEANING[lap.durationMeaning]}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
    {observation.laps.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>구간 20개 더 보기</button>}
    {observation.laps.length === 0 && <p>전체 기록만 있어 구간별로 나눠 비교할 수 없어요.</p>}
    <div className="file-analysis-actions">{observation.laps.length > 0 && <FilePlanComparison entryId={observation.journalEntryId} />}<FileObservationCorrection entryId={observation.journalEntryId} /></div>
  </InfoDisclosure>
}

export function FileAnalysisPanel({ entries, pendingVerificationCount = 0, onOpenPlan }: {
  readonly entries: readonly FileAnalysisEntry[]
  readonly pendingVerificationCount?: number
  readonly onOpenPlan?: () => void
}) {
  const available = entries.filter(entry => entry.kind === "post-session" && entry.fileObservation !== undefined)
  const dates = available.map(entry => entry.date).sort()
  const [selectedWindow, setSelectedWindow] = React.useState<{ startDate: string; endDate: string } | null>(null)
  const [activityLimit, setActivityLimit] = React.useState(20)
  const startDate = selectedWindow?.startDate ?? dates[0] ?? todayISO()
  const endDate = selectedWindow?.endDate ?? dates.at(-1) ?? todayISO()
  React.useEffect(() => { setActivityLimit(20) }, [startDate, endDate])
  const report = React.useMemo(() => {
    try { return buildFileAnalysisReport(entries, { startDate, endDate, sourceContext: "ACCOUNT_CONFIRMED" }) }
    catch { return null }
  }, [entries, startDate, endDate])
  if (fileAnalysisFormats().length === 0 || (available.length === 0 && pendingVerificationCount === 0)) return null
  const pendingNotice = pendingVerificationCount > 0 && <p role="status">이전에 저장한 파일 기록 {pendingVerificationCount}개의 최신 상태를 계정에서 확인하지 못했어요. 기록은 보관돼 있으며, 확인 전에는 아래 분석에서 제외해요. 인터넷 연결을 확인한 뒤 다시 열어 주세요.</p>
  if (available.length === 0) return <section className="file-analysis-panel" aria-labelledby="file-analysis-title" data-testid="file-analysis-panel">
    <h2 id="file-analysis-title">가져온 기록 분석</h2>{pendingNotice}
  </section>
  return <section className="file-analysis-panel" aria-labelledby="file-analysis-title" data-testid="file-analysis-panel">
    <h2 id="file-analysis-title">가져온 기록 분석</h2>
    {pendingNotice}
    <div className="file-observation-review">
      <InfoDisclosure title={`${startDate} ~ ${endDate} · 기간 바꾸기`}>
        <label>시작 날짜<input type="date" value={startDate} onChange={event => setSelectedWindow({ startDate: event.target.value, endDate })} /></label>
        <label>마지막 날짜<input type="date" value={endDate} onChange={event => setSelectedWindow({ startDate, endDate: event.target.value })} /></label>
        {selectedWindow && <button type="button" onClick={() => setSelectedWindow(null)}>전체 기간</button>}
      </InfoDisclosure>
    </div>
    {!report ? <p role="alert">시작 날짜와 마지막 날짜를 확인해 주세요.</p> : <>
      <p>{report.includedSourceCount}개 운동 · 중복 사본 {report.duplicateSourceCount}개 제외 · 확인 필요 {report.excludedSourceCount}개</p>
      {report.coverage === "NO_DATA" && <p>이 기간에 가져온 기록이 없어요. 다른 기간을 골라 주세요.</p>}
      {report.sports.map(sport => <div key={sport.sport}>
        <h3>{SPORT[sport.sport]} · {sport.sampleCount}개</h3>
        <dl className="file-analysis-metrics"><div><dt>기록된 거리 · {sport.distanceMeters.sampleCount}개 사용</dt>
          <dd>{sport.distanceMeters.value === null ? "미기록" : `${number(sport.distanceMeters.value / 1000)}km`}</dd></div></dl>
        {sport.timeSummaries.map(time => <div key={time.durationMeaning}>
          <h3>{MEANING[time.durationMeaning]}</h3>
          {time.referenceOnly ? <p>시간의 뜻을 확인한 뒤 같은 종류의 시간끼리만 합계·페이스를 계산해요. 구간 원본은 아래에서 볼 수 있어요.</p> :
            <dl className="file-analysis-metrics"><div><dt>시간 합계 · {time.durationSeconds.sampleCount}개 사용</dt><dd>{fileDuration(time.durationSeconds.value)}</dd></div>
              <div><dt>평균 페이스 · 거리·시간이 함께 있는 {time.paceSecondsPerKm.sampleCount}개</dt><dd>{pace(time.paceSecondsPerKm.value)}</dd></div></dl>}
        </div>)}
      </div>)}
      <InfoDisclosure title="계산에 쓴 기록과 빠진 항목">
        <p>평균 페이스는 같은 시간 종류의 기록에서 거리 합계와 시간 합계로 계산해요. 걷기·자전거는 달리기 마일리지에 넣지 않아요.</p>
        {report.exclusions.map(item => <p key={item.reasonCode}>{REASON[item.reasonCode]} · {item.count}개</p>)}
        {report.sports.flatMap(sport => sport.distanceMeters.exclusions.map(item => <p key={`${sport.sport}-${item.reasonCode}`}>{SPORT[sport.sport]} · {REASON[item.reasonCode]} {item.count}개</p>))}
        {report.sports.flatMap(sport => sport.timeSummaries.flatMap(time => time.paceSecondsPerKm.exclusions.map(item =>
          <p key={`${sport.sport}-${time.durationMeaning}-${item.reasonCode}`}>{SPORT[sport.sport]} · {MEANING[time.durationMeaning]} 페이스 · {REASON[item.reasonCode]} {item.count}개</p>)))}
        <p>이 자료는 파일에 담긴 수행 기록이에요. 개인 최고기록, 에너지 시스템 능력, 회복 상태를 자동으로 판정하지 않아요.</p>
      </InfoDisclosure>
      <h3>운동별 구간</h3>
      {report.observations.slice(0, activityLimit).map(observation => <ActivitySegments key={observation.sourceObservationKey} observation={observation} />)}
      {report.observations.length > activityLimit && <button type="button" onClick={() => setActivityLimit(value => value + 20)}>운동 20개 더 보기</button>}
      {onOpenPlan && report.includedSourceCount > 0 && <div className="file-analysis-actions">
        <button type="button" onClick={onOpenPlan}>다음 훈련 살펴보기 <ArrowRight size={16} aria-hidden="true" /></button>
      </div>}
    </>}
  </section>
}
