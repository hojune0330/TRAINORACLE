import React from "react"
import { ArrowRight, CalendarDays, ChevronDown, Check, Layers } from "lucide-react"
import type { OracleReport as Report } from "../../domain/oracle-report"
import { ORACLE_DEMO_SCENARIOS, type OracleDemoScenarioId } from "../../domain/oracle-demo-scenario"
import { OracleReportShare } from "./OracleReportShare"
import { projectOracleShare } from "../../domain/oracle-report-share"
import type { AnalysisSection } from "../../domain/analysis-navigation"
import { ENERGY_SYSTEM_META } from "../../domain/energy-system-taxonomy"
import { AppHeading } from "../../components/AppHeading"
import { AccessibleTrendTable } from "./AccessibleTrendTable"
import { MetricSelectorSheet } from "./MonthlyTrendSection"
import { formatTrendValue, monthText, TREND_METRIC_OPTIONS, type DisplayTrendMetric } from "./trend-display"
import "./oracle-report.css"

export type OracleReportSelection = {
  readonly source: "my" | "example"
  readonly months: 3 | 6
  readonly metric: DisplayTrendMetric
  readonly selectedMonth?: string | undefined
  readonly evidenceExpanded?: boolean | undefined
  readonly scenario?: OracleDemoScenarioId | undefined
  readonly selectedDay?: string | undefined
}

function km(value: number | null): string { return value === null ? "미기록" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} km` }
function dateRange(start: string, end: string): string { return `${start.replaceAll("-", ".")} – ${end.replaceAll("-", ".")}` }

/** Read-only presentation: every value comes from the common report projection. */
export function OracleReport({ report, view, selection, onSelectionChange, readState, hasSavedEntries,
  onRetry, onOpenDay, onWriteLog, onWriteRecovery, onOpenImport, onOpenPlan, onOpenTopics, onOpenRecords, accountScopeKey = "current",
}: {
  readonly report: Report
  readonly view: Exclude<AnalysisSection, "files">
  readonly selection: OracleReportSelection
  readonly onSelectionChange: (next: OracleReportSelection) => void
  readonly readState: "ready" | "loading" | "error"
  readonly hasSavedEntries: boolean
  readonly onRetry?: (() => void) | undefined
  readonly onOpenDay?: ((date: string, entryId?: string) => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
  readonly onWriteRecovery?: (() => void) | undefined
  readonly onOpenImport?: (() => void) | undefined
  readonly onOpenPlan?: (() => void) | undefined
  readonly onOpenTopics?: (() => void) | undefined
  readonly accountScopeKey?: string | undefined
  readonly onOpenRecords?: (() => void) | undefined
}) {
  const [shareOpen, setShareOpen] = React.useState(false)
  const [selectorOpen, setSelectorOpen] = React.useState(false)
  const [exampleEntry, setExampleEntry] = React.useState<string | null>(null)
  const selectorRef = React.useRef<HTMLButtonElement>(null)
  const monthSelectionLabelId = React.useId()
  const returnFocusTo = React.useCallback(() => selectorRef.current, [])
  React.useEffect(() => { setExampleEntry(null); setShareOpen(false) }, [selection.source, selection.scenario, selection.months, selection.selectedMonth, accountScopeKey])
  const isExample = selection.source === "example"
  const blocked = !isExample && readState !== "ready"
  React.useEffect(() => { if (blocked) setShareOpen(false) }, [blocked])
  React.useEffect(() => {
    if (selection.selectedDay && !report.monthly.some(month => month.days.some(day => day.date === selection.selectedDay))) {
      onSelectionChange({ ...selection, selectedDay: undefined })
    }
  }, [report, selection, onSelectionChange])
  const confirmedEmpty = !hasSavedEntries && report.status === "missing"
  const metricName = TREND_METRIC_OPTIONS.find(option => option.metric === selection.metric)!.buttonLabel
  const selectedMonth = report.monthly.find(month => month.label === selection.selectedMonth)
  const sourceLabel = isExample ? "예시 · 가상 기록" : "내 기록"
  const monthly = view === "monthly"
  const mix = view === "mix"
  const distanceMonths = report.monthly.filter(month => month.distance.totalKm !== null)
  const metricMonths = report.monthly.filter(month => month.metrics[selection.metric].kind === "DATA")
  const allMixRows = report.energy.rows.map(row => ({ key: row.key, label: ENERGY_SYSTEM_META[row.key].shortLabel,
    value: report.energy.coverage === "MISSING" ? null : row.journalSessionCount,
    text: report.energy.coverage === "MISSING" ? "미기록" : `${row.journalSessionCount}회` }))
  const chartRows = mix ? allMixRows.filter(row => row.value !== null && row.value > 0) : report.monthly.map(month => {
      const bucket = month.metrics[selection.metric]
      return { key: month.label, label: monthText(month.label),
        value: monthly ? bucket.kind === "DATA" ? bucket.median : null : month.distance.totalKm,
        text: monthly ? bucket.kind === "DATA" ? formatTrendValue(selection.metric, bucket.median) : "미기록" : km(month.distance.totalKm) }
    })
  const hasChartData = chartRows.some(row => row.value !== null)
  const max = Math.max(...chartRows.flatMap(row => row.value === null ? [] : [row.value]), 1)
  const completedDistanceMonths = distanceMonths.filter(month => !month.partialMonth)
  const topDistance = [...(completedDistanceMonths.length > 0 ? completedDistanceMonths : distanceMonths)].sort((a, b) => (b.distance.totalKm ?? 0) - (a.distance.totalKm ?? 0))[0]
  const factMetrics = ['RPE', 'MOOD', 'PAIN_MAX'] as const
  const factMonths = factMetrics.map(metric => ({ metric, month: [...report.monthly].reverse().find(month => month.metrics[metric].kind === 'DATA') }))
  const headline = monthly ? `${metricName}의 월별 변화`
    : mix ? "직접 고른 훈련 종류"
      : view === "summary" ? report.insights.hero.headline
        : report.distance.totalKm === null ? "이 기간에 남긴 훈련" : `${selection.months}개월 동안 달린 거리`
  const chartTitle = monthly ? `${metricName} · 월별 중앙값` : mix ? "훈련 종류별 기록 횟수" : "월별 누적 거리"
  const evidence = report.evidence.filter(item => (!selectedMonth || item.date.startsWith(selectedMonth.label))
    && (monthly ? item.metrics[selection.metric] !== undefined : mix ? item.energyIncluded : view === "summary"
      ? item.distanceIncluded || item.energyIncluded || factMonths.some(({ metric, month }) => month && item.date.startsWith(month.label) && item.metrics[metric] !== undefined)
      : item.distanceIncluded))
  const selectedBucket = selectedMonth?.metrics[selection.metric]
  const interpretation = monthly
    ? "각 달에 남긴 값의 중앙값이에요. 기록이 없는 달은 선이나 0으로 이어 채우지 않아요."
    : mix ? "일지에서 직접 선택한 주된 목적의 횟수예요. 신체의 에너지 기여율이나 적정 비율을 뜻하지 않아요."
      : view === "summary" ? `거리 기록 ${report.distance.includedSourceCount}건을 합산했어요. 훈련 종류는 직접 고른 기록 ${report.energy.includedSourceCount}건을 반영했어요.`
        : topDistance ? `${report.period.currentMonthPartial && completedDistanceMonths.length > 0 ? "완료된 달 중 " : ""}${monthText(topDistance.label)}의 기록 거리 합계가 ${km(topDistance.distance.totalKm)}로 가장 많아요. 기록하지 않은 운동은 포함하지 않아요.`
        : "기록한 값이 있는 항목부터 확인할 수 있어요. 훈련 완료 표시는 실제 거리로 합산하지 않아요."
  const missingMetric = monthly ? metricMonths.length === 0 : mix ? report.energy.coverage === "MISSING" : report.distance.totalKm === null

  return <section className="oracle-report" aria-label="기간별 훈련 리포트" data-source={selection.source} data-view={view}>
    <div className="oracle-report__controls">
      <div className="app-choice-group oracle-report__source" role="group" aria-label="리포트 자료">
        {([['my', '내 기록'], ['example', '예시']] as const).map(([source, label]) => <button type="button" key={source}
          className="app-choice-control" aria-pressed={selection.source === source}
          onClick={() => { if (source !== selection.source) onSelectionChange({ ...selection, source, selectedMonth: undefined, selectedDay: undefined, evidenceExpanded: false }) }}>{label}</button>)}
      </div>
      <div className="app-choice-group oracle-report__period" role="group" aria-label="리포트 기간">
        {([3, 6] as const).map(months => <button type="button" key={months} className="app-choice-control"
          aria-pressed={selection.months === months} onClick={() => {
            // Both windows end on the same date; a shortened window retains only a visible selection.
            const retained = months === 6 || report.monthly.slice(-3).some(month => month.label === selection.selectedMonth)
            onSelectionChange({ ...selection, months, selectedMonth: retained ? selection.selectedMonth : undefined, selectedDay: retained ? selection.selectedDay : undefined })
          }}>{months}개월</button>)}
      </div>
    </div>
    {isExample && <div className="oracle-report__scenarios" role="group" aria-label="예시 상황">
      {ORACLE_DEMO_SCENARIOS.map(scenario => <button type="button" key={scenario.id} aria-pressed={(selection.scenario ?? "ten-k") === scenario.id}
        onClick={() => { if (scenario.id !== (selection.scenario ?? "ten-k")) onSelectionChange({ ...selection, scenario: scenario.id, selectedMonth: undefined, selectedDay: undefined, evidenceExpanded: false }) }}>{({ 'first-5k': '첫 5km', 'ten-k': '10km 준비', 'track-1500': '트랙 훈련 1500m', restart: '다시 시작' })[scenario.id]}</button>)}
    </div>}
    <p className="oracle-report__range"><CalendarDays size={16} aria-hidden="true" />{dateRange(report.period.startDate, report.period.endDate)}
      {isExample && <span className="oracle-report__example">예시 · 가상 기록</span>}</p>
    {report.period.currentMonthPartial && !blocked && <p className="oracle-report__source-note">이번 달은 오늘까지의 기록이에요.</p>}
    {blocked ? <div className="oracle-report__state" role="status">
      <AppHeading as="h2" variant="section">{readState === "loading" ? "기록을 확인하고 있어요" : "기록을 아직 모두 확인하지 못했어요"}</AppHeading>
      <p>확인을 마친 뒤 내 리포트를 표시해요.</p>
      {readState === "error" && onRetry && <button type="button" onClick={onRetry}>다시 확인</button>}
    </div> : <>
      {report.notices.filter(notice => notice.includes("불러오지 못해")).map(notice => <div key={notice} className="oracle-report__source-note" role="status"><p>{notice}</p>
        {notice.startsWith("경기") && onOpenRecords && <button type="button" className="oracle-report__share" onClick={onOpenRecords}>경기 기록 보기</button>}
        {notice.startsWith("계획") && onOpenPlan && <button type="button" className="oracle-report__share" onClick={onOpenPlan}>현재 훈련표 보기</button>}
      </div>)}
      {!confirmedEmpty && <header className="oracle-report__observation">
        <AppHeading as="h2" variant="section">{headline}</AppHeading>
        {view === "summary" && <><p>{report.scopedEntryCount}개 기록{report.workoutDayCount > 0 ? ` · ${report.workoutDayCount}일의 운동 기록` : ''}</p>
          {report.insights.hero.ruleId === "SAME_EVENT_RACE_CHANGE" && <><p>{report.insights.hero.observation}</p>
            {!isExample && onOpenRecords && <button type="button" className="oracle-report__share" onClick={onOpenRecords}>경기 기록 보기</button>}</>}
          <div className="oracle-report__facts" aria-label="기간 핵심 수치">
            {report.distance.totalKm !== null && <p><span>누적 거리</span><strong>{km(report.distance.totalKm)}</strong></p>}
            {report.workoutDayCount > 0 && <p><span>운동을 기록한 날</span><strong>{report.workoutDayCount}일</strong></p>}
            {report.raceChange && <p><span>같은 종목 경기 기록 변화</span><strong>{report.raceChange.deltaSeconds > 0 ? "+" : ""}{report.raceChange.deltaSeconds}초</strong><small>최근 기록 − 이전 기록</small></p>}
          </div></>}
        {view === "summary" && <details className="oracle-report__basis"><summary>핵심 관찰의 근거</summary><p>{report.insights.hero.observation}</p><p>{report.insights.hero.coverage}</p>{report.insights.hero.limitations.map(limit => <p key={limit}>{limit}</p>)}</details>}
        {view === "distance" && report.distance.totalKm !== null && <>
          <p className="oracle-report__total-label">{selection.months}개월 누적 거리</p>
          <p className="oracle-report__number">{km(report.distance.totalKm)}</p>
        </>}
        {(report.distance.excludedSourceCount > 0 || report.energy.excludedSourceCount > 0) && <p className="oracle-report__partial" role="status">집계 제외 · 거리 {report.distance.excludedSourceCount}건 · 훈련 종류 {report.energy.excludedSourceCount}건</p>}
        {monthly && report.metricCoverage[selection.metric].excluded > 0 && <p className="oracle-report__partial" role="status">{metricName} 집계 제외 {report.metricCoverage[selection.metric].excluded}건</p>}
      </header>}
      {monthly && <div className="oracle-report__metric">
        <button ref={selectorRef} type="button" aria-label={`지표 선택: ${metricName}`} aria-haspopup="dialog"
          aria-expanded={selectorOpen} onClick={() => setSelectorOpen(true)}>{metricName}<ChevronDown size={18} aria-hidden="true" /></button>
        <span>{selection.metric === "DISTANCE_KM" ? "운동 1회 거리 · 월 합계와 달라요" : selection.metric === "SECONDS_PER_KM" ? "분:초/km · 월별 중앙값" : "직접 남긴 값 · 월별 중앙값"}</span>
      </div>}
      {mix && !confirmedEmpty && <p className="oracle-report__source-note">직접 고른 종류가 있는 {report.energy.includedSourceCount}개 기록 기준 · 분류 미확인 {report.unknownPurposeCount}개 기록</p>}
      {hasChartData ? <section className="oracle-report__chart-section" aria-label={chartTitle}>
        <h3>{chartTitle}</h3>
        <div className="oracle-report__chart" role="img" aria-label={`${sourceLabel}. ${chartTitle}. ${chartRows.map(row => `${row.label} ${row.text}`).join('. ')}`}>
          {chartRows.map(row => <div className="oracle-report__bar-row" key={row.key} data-selected={row.key === selection.selectedMonth} aria-hidden="true">
            <span>{row.label}</span><div className="oracle-report__track">{row.value !== null && <span style={{ width: `${row.value / max * 100}%` }} />}</div><strong>{row.text}</strong>
          </div>)}
        </div>
        {mix && allMixRows.some(row => row.value === 0) && <details className="oracle-report__basis"><summary>기록 없는 종류 {allMixRows.filter(row => row.value === 0).length}개</summary>
          <p>{allMixRows.filter(row => row.value === 0).map(row => row.label).join(" · ")}</p></details>}
        {!mix && <>
        <p className="oracle-report__month-label" id={monthSelectionLabelId}>근거를 볼 월</p>
        <div className="oracle-report__months" role="group" aria-label="근거를 볼 월 선택" aria-describedby={monthSelectionLabelId}>
          {report.monthly.map(month => <button type="button" key={month.label} aria-pressed={selection.selectedMonth === month.label}
            aria-label={`${monthText(month.label)} 근거 보기`} onClick={() => onSelectionChange({ ...selection,
              selectedMonth: selection.selectedMonth === month.label ? undefined : month.label, selectedDay: undefined })}>
            <span>{monthText(month.label)}</span><Check size={16} aria-hidden="true" />
          </button>)}
        </div></>}
        <AccessibleTrendTable caption={`${sourceLabel} · ${chartTitle}`} rows={(mix ? allMixRows : chartRows).map(row => ({ key: row.key, label: row.label, value: row.text }))} />
        <p className="oracle-report__interpretation">{interpretation}</p>
      </section> : <div className="oracle-report__state" role="status">
        <h3>{hasSavedEntries || isExample ? `이 기간에는 ${monthly ? metricName : mix ? "훈련 종류" : "거리"} 값이 없어요` : "아직 이 기간에 남긴 기록이 없어요"}</h3>
        <p>{hasSavedEntries ? "저장한 일지는 있어요. 분석에 쓸 수 있는 값은 기록마다 달라요." : "운동과 몸 상태를 남기면 같은 화면에서 내 변화를 볼 수 있어요."}</p>
        {!isExample && <button type="button" onClick={() => onSelectionChange({ ...selection, source: "example", selectedMonth: undefined, selectedDay: undefined, evidenceExpanded: false })}>예시 결과 보기<ArrowRight size={16} aria-hidden="true" /></button>}
      </div>}
      {view === "summary" && <>
        {selectedMonth && <section className="oracle-report__purpose" aria-label="선택한 달 훈련 구성"><h3>{monthText(selectedMonth.label)} 훈련 구성</h3>
          {report.energy.rows.filter(row => (selectedMonth.purposeCounts[row.key] ?? 0) > 0).map(row => <p key={row.key}>{ENERGY_SYSTEM_META[row.key].shortLabel}<strong>{selectedMonth.purposeCounts[row.key]}회</strong></p>)}
          {selectedMonth.unknownPurposeCount > 0 && <p>분류 미확인<strong>{selectedMonth.unknownPurposeCount}개 기록</strong></p>}
          <p className="oracle-report__source-note">일지에서 직접 고른 주된 목적 기준</p></section>}
        {([['strengths', '잘한 점'], ['attention', '함께 살펴볼 점']] as const).map(([key, title]) => report.insights[key].some(insight => insight.ruleId !== report.insights.hero.ruleId) && <section className="oracle-report__insights" key={key} aria-label={title}><h3>{title}</h3>
          {report.insights[key].filter(insight => insight.ruleId !== report.insights.hero.ruleId).slice(0, 2).map(insight => <article key={insight.ruleId}><h4>{insight.headline}</h4><p>{insight.observation}</p><small>{insight.coverage}</small>
            {insight.evidenceRefs.map(ref => report.evidence.find(item => item.id === ref)).filter((item): item is Report['evidence'][number] => !!item).slice(0, 2).map(item => <ul className="oracle-report__evidence-list" key={item.id}>{renderEvidenceRow(item)}</ul>)}
            {insight.limitations.length > 0 && <details className="oracle-report__basis"><summary>해석 범위</summary>{insight.limitations.map(limit => <small key={limit}>{limit}</small>)}</details>}
            {insight.action === "records" && onOpenRecords && !isExample && <button type="button" className="oracle-report__share" onClick={onOpenRecords}>경기 기록 보기</button>}
            {insight.action === "plan" && onOpenPlan && !isExample && <button type="button" className="oracle-report__share" onClick={onOpenPlan}>현재 훈련표 보기</button>}
          </article>)}</section>)}
        {projectOracleShare(report, "summary") && <button type="button" className="oracle-report__share" onClick={() => setShareOpen(true)}>한 장으로 남기기</button>}
      </>}
      {view === "distance" && selectedMonth && <section className="oracle-report__days" aria-label={`${monthText(selectedMonth.label)} 날짜별 훈련량`}>
        <h3>{monthText(selectedMonth.label)} 날짜별 기록</h3>
        {selectedMonth.days.map(day => <details key={day.date} className="oracle-report__basis" open={selection.selectedDay === day.date}
          onToggle={event => { if (event.currentTarget.open !== (selection.selectedDay === day.date)) onSelectionChange({ ...selection, selectedDay: event.currentTarget.open ? day.date : undefined }) }}><summary>{day.date} · {km(day.distanceKm)} · {day.durationMinutes === null ? '시간 미기록' : `${day.durationMinutes}분`}</summary>
          <ul className="oracle-report__evidence-list">{day.evidenceRefs.map(ref => report.evidence.find(item => item.id === ref)).filter((item): item is Report['evidence'][number] => !!item).map(renderEvidenceRow)}</ul>
        </details>)}
      </section>}
      {!confirmedEmpty && <section className="oracle-report__evidence" aria-label="리포트 근거">
        <div className="oracle-report__section-heading"><h3>{selectedMonth ? `${monthText(selectedMonth.label)} 근거` : "반영한 기록"}</h3>
          {selectedMonth && <button type="button" onClick={() => onSelectionChange({ ...selection, selectedMonth: undefined, selectedDay: undefined })}>전체 기간</button>}</div>
        {selectedMonth && <p>{dateRange(selectedMonth.startDate, selectedMonth.endDate)}{selectedMonth.partialMonth ? " · 오늘까지" : ""}
          {monthly && selectedBucket?.kind === "DATA" ? ` · ${metricName} 중앙값 ${formatTrendValue(selection.metric, selectedBucket.median)} · ${selectedBucket.n}건` : ""}</p>}
        {evidence.length > 0 ? <>
        <ul className="oracle-report__evidence-list">
          {evidence.slice(0, 3).map(renderEvidenceRow)}
        </ul>
        {evidence.length > 3 && <details className="oracle-report__all-evidence" open={selection.evidenceExpanded === true}
          onToggle={event => { if (event.currentTarget.open !== (selection.evidenceExpanded === true)) onSelectionChange({ ...selection, evidenceExpanded: event.currentTarget.open }) }}><summary>반영 기록 {evidence.length}개 모두 보기</summary>
          <ul className="oracle-report__evidence-list">{evidence.slice(3).map(renderEvidenceRow)}</ul>
        </details>}
        </> : <p>{missingMetric ? "이 지표에 반영한 기록이 없어요." : "이 달에 반영한 기록이 없어요."}</p>}
        <details className="oracle-report__basis"><summary>집계 기준·출처</summary>
          <p>거리 합계: 반영 {report.distance.includedSourceCount}건 · 제외 {report.distance.excludedSourceCount}건 · 중복 {report.distance.duplicateSourceCount}건 · 충돌 {report.distance.conflictingSourceCount}건</p>
          <p>훈련 종류: 반영 {report.energy.includedSourceCount}건 · 제외 {report.energy.excludedSourceCount}건 · 중복 {report.energy.duplicateSourceCount}건 · 충돌 {report.energy.conflictingSourceCount}건</p>
          {monthly && <p>{metricName}: 반영 {report.metricCoverage[selection.metric].included}건 · 제외 {report.metricCoverage[selection.metric].excluded}건</p>}
          <p>월 누적 거리는 합계, 월별 변화는 운동 1회 또는 하루 기록의 중앙값이에요. 기록이 없는 값은 0으로 채우지 않아요.</p>
          {report.exclusions.excludedImported > 0 && <p data-testid="trends-excluded-imported">가져온 일지 {report.exclusions.excludedImported}개의 외부 수치 중 확인되지 않은 값은 분석에서 제외했어요. 일지에는 그대로 남아 있어요. 같은 일지의 직접 기록은 항목별 기준으로 사용하며, 같은 값을 다시 입력할 필요는 없어요.</p>}
          {report.exclusions.excludedNoProvenance > 0 && <p data-testid="trends-excluded-no-provenance">일지 {report.exclusions.excludedNoProvenance}개는 값의 출처가 없어 일부 수치를 분석에 넣지 못했어요. 일지 내용은 그대로 남아 있어요. 같은 내용을 다시 입력할 필요는 없어요.</p>}
          {report.notices.map(notice => <p key={notice}>{notice}</p>)}
          <p>확인된 구조화 기록만 읽어요. 개인 메모를 읽거나 계획·포인트를 바꾸지 않아요.</p>
        </details>
      </section>}
      <div className="oracle-report__next" aria-label="리포트 다음 행동">
        {isExample ? <button type="button" onClick={() => onSelectionChange({ ...selection, source: "my", selectedMonth: undefined, selectedDay: undefined, evidenceExpanded: false })}>내 기록으로 보기<ArrowRight size={18} aria-hidden="true" /></button>
          : missingMetric && (selection.metric === "MOOD" || selection.metric === "PAIN_MAX") && monthly && onWriteRecovery
            ? <button type="button" onClick={onWriteRecovery}>몸 상태 남기기<ArrowRight size={18} aria-hidden="true" /></button>
            : (missingMetric || report.workoutDayCount < 3) && onWriteLog && <button type="button" onClick={onWriteLog}>{hasSavedEntries ? "운동 기록 더 남기기" : "운동 기록 쓰기"}<ArrowRight size={18} aria-hidden="true" /></button>}
        {!isExample && missingMetric && (!monthly && !mix || monthly && selection.metric === "DISTANCE_KM") && onOpenImport && <button type="button" onClick={onOpenImport}>운동 파일 가져오기</button>}
        {!isExample && onOpenPlan && <button type="button" onClick={onOpenPlan}>현재 훈련표 보기</button>}
        {onOpenTopics && <button type="button" onClick={onOpenTopics}><Layers size={16} aria-hidden="true" />경기·계획·훈련 비교하기</button>}
      </div>
    </>}
    {selectorOpen && <MetricSelectorSheet metric={selection.metric} onSelect={metric => onSelectionChange({ ...selection, metric })}
      onClose={() => setSelectorOpen(false)} returnFocusTo={returnFocusTo} />}
    {shareOpen && !blocked && <OracleReportShare report={report} accountScopeKey={accountScopeKey} onClose={() => setShareOpen(false)} />}
  </section>

  function renderEvidenceRow(item: Report["evidence"][number]) {
    return <li key={item.id}>
            <div><span>{item.date}</span><strong>{item.kind === "post-session" ? "운동 기록" : "몸 상태 기록"}</strong>
              <small>{mix && item.energySystem ? ENERGY_SYSTEM_META[item.energySystem].shortLabel
                : monthly && item.metrics[selection.metric] !== undefined ? `${metricName} ${formatTrendValue(selection.metric, item.metrics[selection.metric]!)}`
                : item.metrics.DISTANCE_KM !== undefined ? km(item.metrics.DISTANCE_KM)
                  : item.energySystem ? ENERGY_SYSTEM_META[item.energySystem].shortLabel
                    : Object.entries(item.metrics).map(([key, value]) => key === "RPE" ? `힘든 정도 ${value}/10` : `${TREND_METRIC_OPTIONS.find(option => option.metric === key)?.buttonLabel ?? key} ${formatTrendValue(key as DisplayTrendMetric, value!)}`).join(" · ")}</small>
              {item.methodDetail && <details className="oracle-report__basis"><summary>훈련 구성 근거</summary><small>{item.methodDetail}</small></details>}</div>
            {isExample ? <button type="button" aria-expanded={exampleEntry === item.id} aria-label={`${item.date} 예시 기록 보기`}
              onClick={() => setExampleEntry(exampleEntry === item.id ? null : item.id)}>예시 보기</button>
              : onOpenDay && <button type="button" aria-label={`${item.date} ${item.kind === "post-session" ? "운동" : "몸 상태"} 일지 보기`}
                onClick={() => onOpenDay(item.date, item.id)}>일지 보기<ArrowRight size={16} aria-hidden="true" /></button>}
            {isExample && exampleEntry === item.id && <p className="oracle-report__example-detail">가상 기록 · {Object.entries(item.metrics).map(([key, value]) => key === "RPE" ? `힘든 정도 ${value}/10` : `${TREND_METRIC_OPTIONS.find(option => option.metric === key)?.buttonLabel ?? key} ${formatTrendValue(key as DisplayTrendMetric, value!)}`).join(" · ")}</p>}
    </li>
  }
}
