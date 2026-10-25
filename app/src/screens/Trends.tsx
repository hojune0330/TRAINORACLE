import React from "react"
import { ArrowRight, Calculator, ChartColumn, Layers, CalendarDays, FileChartColumn, TrendingUp } from "lucide-react"
import { OracleSectionNavigation, type OracleHubSection } from "../components/OracleSectionNavigation"
export type { OracleHubSection } from "../components/OracleSectionNavigation"
import { CategoryCard, CategoryDisclosure } from "../components/CategoryCard"
import { CategoryShortcuts } from "../components/CategoryShortcuts"
import { useAppOverlayNavigation } from "../components/AppOverlayNavigation"
import { projectStructuredJournalObservations } from "../domain/journal-observation"
import { analysisExclusionSummary, loadEntries, loadEntriesForPlanSafety } from "../domain/journal-store"
import { MonthlyTrendSection } from "./trends/MonthlyTrendSection"
import { RecoveryRecordPanel } from "./trends/RecoveryRecordPanel"
import { RecordStartActions } from "../components/RecordStartActions"
import { useAthleteRecordsSnapshot } from "../hooks/useAthleteRecordsSnapshot"
import { paceClock, paceEventLabel } from "../domain/pace-tools"
import { athleteRecordAuthorityCopy } from "../domain/athlete-record-display"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { useLocalToday } from "../hooks/useLocalToday"
import { ImportedRecordPreview } from "./trends/ImportedRecordPreview"
import { productFeatures } from "../domain/product-features"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { activePlanDateWindow } from "../domain/cumulative-distance"
import { CumulativeDistancePanel } from "./trends/CumulativeDistancePanel"
import { EnergySystemLedgerPanel } from "./trends/EnergySystemLedgerPanel"
import { PersonalOraclePanel } from "./trends/PersonalOraclePanel"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { FileAnalysisPanel } from "./trends/FileAnalysisPanel"
import { readAccountJournalProjection, readCurrentConfirmedAccountJournalProjection } from "../domain/account/account-journal-projection"
import { OracleTopicGrid } from "../components/OracleTopicGrid"
import { OracleResume } from "../components/OracleResume"
import type { OracleTopicId } from "../domain/oracle-exploration"
import type { AnalysisNavigation, AnalysisSection } from "../domain/analysis-navigation"
import { fileAnalysisFormats } from "../domain/import/file-analysis-policy"
import { HomeCoachingSummary } from "./home/HomeCoachingSummary"
import { TaskGuide } from "../components/TaskGuide"
import { OracleExamplePreview } from "./trends/OracleExamplePreview"
import { analysisPresentation } from "./trends/analysis-presentation"
import { personalOraclePresentation } from "./trends/personal-oracle-presentation"
import type { DisplayTrendMetric } from "./trends/trend-display"
import "./trends/trends-hub.css"

const ANALYSIS_SECTIONS = [
  { id: "summary", label: "훈련 요약", description: "남긴 운동과 계획", icon: TrendingUp },
  { id: "distance", label: "훈련량", description: "달린 거리 합계", icon: ChartColumn },
  { id: "mix", label: "훈련 구성", description: "직접 고른 훈련 종류", icon: Layers },
  { id: "monthly", label: "월별 변화", description: "거리·페이스·기분·통증", icon: CalendarDays },
  { id: "files", label: "파일 분석", description: "운동 파일의 구간 기록", icon: FileChartColumn },
] as const

export function Trends({ onBack, onWriteLog, onOpenImport, onOpenRecords, onWriteRecovery, onOpenPlan, onOpenOracle, onOpenRecordReading, onOpenRunningProfile, onOpenOracleLibrary, onOpenTrainingContent, onOpenCoachingDay, oracleV2Enabled = false, journalReadComplete, onRetryJournalRead, initialContext, initialOracleSection, onOracleSectionChange, onContextChange }: {
  readonly onBack?: (() => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
  readonly onOpenImport?: (() => void) | undefined
  readonly onOpenRecords?: (() => void) | undefined
  readonly onWriteRecovery?: (() => void) | undefined
  readonly onOpenPlan?: (() => void) | undefined
  readonly onOpenOracle?: ((topic: OracleTopicId, mode?: "example" | "personal") => void) | undefined
  readonly onOpenRecordReading?: (() => void) | undefined
  readonly onOpenRunningProfile?: (() => void) | undefined
  readonly onOpenOracleLibrary?: (() => void) | undefined
  readonly onOpenTrainingContent?: (() => void) | undefined
  readonly onOpenCoachingDay?: ((date: string, entryId?: string) => void) | undefined
  readonly oracleV2Enabled?: boolean | undefined
  readonly journalReadComplete?: boolean | undefined
  readonly onRetryJournalRead?: (() => void) | undefined
  readonly initialContext?: AnalysisNavigation | undefined
  readonly initialOracleSection?: OracleHubSection | undefined
  readonly onOracleSectionChange?: ((section: OracleHubSection) => void) | undefined
  readonly onContextChange?: ((context: AnalysisNavigation) => void) | undefined
}) {
  const navigation = useAppOverlayNavigation()
  const raceRecords = useAthleteRecordsSnapshot()
  const fileAnalysisEnabled = fileAnalysisFormats().length > 0
  const savedRace = raceRecords.records.filter(record => record.purpose !== "RACE_GOAL")
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
  const destinationFor = (target: OracleHubSection) => target === "profile" ? onOpenRunningProfile
    : target === "library" ? (oracleV2Enabled ? onOpenOracleLibrary : onOpenTrainingContent) : undefined
  const [section, setSection] = React.useState<OracleHubSection>(initialOracleSection && !destinationFor(initialOracleSection) ? initialOracleSection : "training")
  const [recoveryOpen, setRecoveryOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<AnalysisSection>(initialContext?.section === "files" && !fileAnalysisEnabled
    ? "summary" : initialContext?.section ?? "summary")
  const [selectedMetric, setSelectedMetric] = React.useState<DisplayTrendMetric | undefined>(initialContext?.metric)
  React.useEffect(() => { setSelectedMetric(initialContext?.metric) }, [initialContext?.metric])
  React.useEffect(() => { if (initialOracleSection) setSection(destinationFor(initialOracleSection) ? "training" : initialOracleSection) }, [initialOracleSection])
  React.useEffect(() => {
    if (!initialContext) return
    setSection("training")
    setDetail(initialContext.section === "files" && !fileAnalysisEnabled ? "summary" : initialContext.section)
  }, [initialContext?.section, initialContext?.metric, initialContext?.savedDate, fileAnalysisEnabled])
  const [entryRevision, setEntryRevision] = React.useState(0)
  React.useEffect(() => {
    const refresh = () => setEntryRevision(value => value + 1)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      unsubscribe()
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])
  const entries = React.useMemo(() => loadEntries(), [entryRevision])
  const accountEntries = React.useMemo(() => readCurrentConfirmedAccountJournalProjection(), [entryRevision])
  const pendingFileCount = React.useMemo(() => {
    const currentIds = new Set(accountEntries.map(entry => entry.id))
    return readAccountJournalProjection().filter(entry => entry.kind === "post-session" && entry.fileObservation
      && !currentIds.has(entry.id)).length
  }, [accountEntries])
  const observations = React.useMemo(() => projectStructuredJournalObservations(entries), [entries])
  const today = useLocalToday()
  const planState = loadPlanBetaState()
  const planFrame = planState?.activePlan.frame
  const planVisibleLength = planFrame === undefined
    ? undefined
    : "projectionLengthDays" in planFrame
      ? planFrame.projectionLengthDays ?? planFrame.lengthDays
      : planFrame.lengthDays
  const planWindow = activePlanDateWindow(planState?.intake.startDate, planVisibleLength)
  const isEmpty = observations.length === 0
  const readComplete = journalReadComplete !== false && loadEntriesForPlanSafety().status === "complete"
  const savedSessions = entries.filter(entry => entry.kind === "post-session").map(({ id, date }) => ({ id, date }))
  // A saved plan is not evidence of a completed workout analysis. Keep the
  // plan available as its own destination, but only show the summary when
  // workouts or structured observations can support it.
  const personalSummary = personalOraclePresentation({ observations, today, planState, savedSessions })
  const presentation = analysisPresentation({ readComplete, hasRecords: entries.length > 0,
    hasFacts: personalSummary.hasAnalysisFacts })
  const hasSummary = readComplete && (savedSessions.some(entry => entry.date <= today) || presentation === "facts")
  const guideTitle = section === "profile" ? "최고기록 살펴보기"
    : section === "library" ? "훈련 이야기 읽기"
      : "내 훈련"
  const startAction = onWriteLog ? { label: savedSessions.length > 0 ? "기록 더 남기기" : "운동 기록 쓰기", run: onWriteLog } : null
  /**
   * 값을 적었는데도 추이에 못 들어간 일지 개수 (Q1).
   * 화면이 침묵하면 사용자는 자기가 적은 값이 왜 그래프에 없는지 알 수 없다.
   * 이 화면의 실제 관문(eligibleMetricValue)에서 가져온 값과 출처 없는 값이
   * 0km로 떨어지는 것을 실행으로 확인한 뒤 붙였다.
   */
  const exclusion = React.useMemo(() => analysisExclusionSummary(), [entryRevision])
  const tools = [
    ...(navigation?.openPaceCalculator ? [{ id: "pace", category: "record" as const, label: "페이스 계산", accessibleLabel: "페이스 계산", icon: Calculator, onClick: () => navigation.openPaceCalculator?.() }] : []),
    ...(onOpenRecordReading ? [{ id: "reading", category: "oracle" as const, label: "기록 풀이", accessibleLabel: "기록 풀이", icon: TrendingUp, onClick: onOpenRecordReading }] : []),
  ]

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[TRENDS] mode=${isEmpty ? "empty" : "data"} observations=${observations.length}`)
    }
  }, [isEmpty, observations.length])

  return (
    <div className="trends-hub">
      <OracleSectionNavigation current={section} onBack={onBack} heading onSelect={target => {
        const destination = destinationFor(target)
        if (destination) { destination(); return }
        setSection(target); onOracleSectionChange?.(target)
      }} />
      <div className="trends-motion-stage">
        <TaskGuide className="trends-hub__guide" title={guideTitle} />
        {section === "training" && <div className="trends-hub__drilldowns" role="group" aria-label="훈련 분석 자세히 보기">
          {ANALYSIS_SECTIONS.filter(item => item.id !== "files").map(item => <button key={item.id} type="button" aria-pressed={detail === item.id}
            aria-label={item.label} aria-describedby={`trends-choice-${item.id}`}
            onClick={() => { setDetail(item.id); onContextChange?.({ ...initialContext, metric: selectedMetric, section: item.id }) }}>
            <span>{item.id === "summary" ? "요약" : item.id === "mix" ? "구성" : item.id === "monthly" ? "월별" : item.label}</span>
            <small id={`trends-choice-${item.id}`}>{item.description}</small>
          </button>)}
        </div>}
        {section === "training" && !readComplete && <div className="trends-hub__read-status">
          <p role="status">기록을 아직 모두 확인하지 못했어요. 확인한 뒤 분석 결과를 표시해요.</p>
          <button type="button" onClick={() => { onRetryJournalRead?.(); setEntryRevision(value => value + 1) }}>다시 확인</button>
        </div>}
        {section === "training" && detail === "summary" && readComplete && <ImportedRecordPreview entries={entries} today={today} onOpenDay={onOpenCoachingDay} />}
        {section === "training" && detail === "summary" && (isEmpty || !hasSummary) && (savedRace || raceRecords.message) && <div className="trends-hub__explore">
          {raceRecords.message && <p role="status">{raceRecords.message}</p>}
          {savedRace && <section className="trends-record-reading" aria-label="최근 저장한 경기 기록">
            <div><p>최근 저장한 경기 기록</p><h2>{paceEventLabel(savedRace.eventDistanceM)} · {paceClock(savedRace.performanceSeconds)}</h2><p>{savedRace.achievedOn ?? "달성일 미입력"} · {athleteRecordAuthorityCopy(savedRace)}</p></div>
            {navigation?.openPaceCalculator && <button type="button" onClick={() => navigation.openPaceCalculator?.({ record: savedRace })}>이 기록으로 페이스 보기<ArrowRight size={18} aria-hidden="true" /></button>}
          </section>}
        </div>}
        {initialContext?.savedDate && selectedMetric === initialContext.metric && section === "training" && detail === initialContext.section && (
          <p className="trends-hub__saved-context" role="status">
            {initialContext.savedDate}에 저장한 {initialContext.metric === "PAIN_MAX" ? "통증을" : initialContext.metric === "MOOD" ? "기분을" : "거리를"} 월별 기록과 함께 볼 수 있어요.
          </p>
        )}
        {pendingFileCount > 0 && !(section === "training" && detail === "files") && (
          <div className="trends-hub__notice" role="status">
            <span>파일 기록 {pendingFileCount}건 · 확인 전 분석에서 제외</span>
            {fileAnalysisEnabled && <button type="button" onClick={() => { setSection("training"); setDetail("files"); onOracleSectionChange?.("training"); onContextChange?.({ ...initialContext, section: "files" }) }}>확인하기</button>}
          </div>
        )}
        {section === "training" && detail === "files" && fileAnalysisEnabled && (
          <>
            <FileAnalysisPanel entries={accountEntries} pendingVerificationCount={pendingFileCount} onOpenPlan={onOpenPlan} />
            {readComplete && !accountEntries.some(entry => entry.kind === "post-session" && entry.fileObservation) && pendingFileCount === 0 && (
              <div className="trends-hub__empty">
                <h2>운동 파일로 구간 살펴보기</h2>
                <p>워치에서 내보낸 운동 파일을 가져오면 구간별 기록을 볼 수 있어요.</p>
                {onOpenImport ? <button type="button" onClick={onOpenImport}>운동 파일 가져오기</button>
                  : onWriteLog && <button type="button" onClick={onWriteLog}>운동 기록 남기기</button>}
              </div>
            )}
            <div style={{ padding: "0 20px" }}><AnalysisExclusionNotice summary={exclusion} /></div>
          </>
        )}
        {section === "profile" && onOpenRecordReading && <section className="trends-record-reading">
          <button type="button" onClick={onOpenRecordReading}>최고기록 풀이 보기<ArrowRight size={18} aria-hidden="true" /></button>
        </section>}
        {section === "library" && onOpenOracle && <div className="trends-hub__explore">
          <OracleTopicGrid onSelectTopic={topic => onOpenOracle(topic, "example")} title="오라클 예시 보기" compact />
          <InfoDisclosure purpose="actions" title="내 관심 주제·기록할 요일"><OracleResume onOpenTopic={onOpenOracle} /></InfoDisclosure>
        </div>}
        {section === "training" && detail === "summary" && readComplete && !hasSummary && planState !== null && onOpenPlan &&
          <div className="trends-hub__explore"><CategoryCard category="training" variant="row" title="훈련표 보기" onClick={onOpenPlan} /></div>}
        {section === "training" && detail === "summary" && hasSummary && <div className="trends-hub__result-layout">
          <div className="trends-hub__result">
            <PersonalOraclePanel observations={observations} today={today} planState={planState} savedSessions={savedSessions}
              summary={personalSummary}
              onOpenPlan={onOpenPlan} onOpenDay={onOpenCoachingDay} onWriteLog={onWriteLog} />
          </div>
          <div className="trends-hub__coaching">
            <HomeCoachingSummary revision={entryRevision} onOpenDay={onOpenCoachingDay} onOpenPlan={onOpenPlan} />
          </div>
        </div>}
        {section === "training" && detail === "summary" && hasSummary && onOpenOracle && <div className="trends-hub__explore">
          <CategoryDisclosure category="oracle" title="경기·계획·훈련 비교하기"><OracleTopicGrid onSelectTopic={onOpenOracle} title="다른 주제 살펴보기" compact /></CategoryDisclosure>
        </div>}
        {section === "training" && detail === "summary" && readComplete && onOpenOracle && <div className="trends-hub__explore">
          <OracleExamplePreview compact={presentation === "facts"} onOpen={() => onOpenOracle("mix", "example")} />
        </div>}
        {section === "training" && detail === "summary" && readComplete && !hasSummary && !savedRace && (startAction || entries.length > 0) &&
          <section className="trends-hub__start trends-hub__explore" aria-label="내 기록으로 시작하기">
            {!savedRace && entries.length > 0 && <p>저장한 일지는 있어요. 분석에 쓸 값은 기록마다 달라요.</p>}
            {!savedRace && startAction && <button type="button" onClick={startAction.run}>{startAction.label}<ArrowRight size={16} aria-hidden="true" /></button>}
          </section>}
        {section === "training" && detail === "summary" && (onOpenImport || onOpenRecords) && <div className="trends-hub__explore">
          <RecordStartActions onImport={onOpenImport} onRecords={onOpenRecords} />
        </div>}
        {section === "training" && readComplete && detail === "distance" && <CumulativeDistancePanel observations={observations} today={today} planWindow={planWindow} mode="full" onWriteLog={onWriteLog} />}
        {section === "training" && readComplete && detail === "mix" && <EnergySystemLedgerPanel observations={observations} today={today} planState={planState} mode="full" onWriteLog={onWriteLog} />}
        {section === "training" && readComplete && detail === "monthly" && <MonthlyTrendSection observations={observations} today={today} initialMetric={selectedMetric}
          onMetricChange={metric => { setSelectedMetric(metric); onContextChange?.({ ...initialContext, savedDate: metric === initialContext?.metric ? initialContext?.savedDate : undefined, section: "monthly", metric }) }}
          onShowExample={onOpenOracle ? () => onOpenOracle("compare", "example") : undefined} onOpenImport={onOpenImport}
          onWriteLog={onWriteLog} onWriteRecovery={onWriteRecovery} />}
        {section === "training" && detail !== "files" && <div style={{ padding: "0 20px" }}>
          <AnalysisExclusionNotice summary={exclusion} />
        </div>}
        {section === "training" && detail === "summary" && <div className="trends-hub__recovery">
          <CategoryCard category="body" title="몸 상태·회복 기록" aria-expanded={recoveryOpen} aria-controls="trends-recovery" onClick={() => setRecoveryOpen(open => !open)} />
          <div id="trends-recovery">{recoveryOpen && <RecoveryRecordPanel today={today} entries={entries} observations={observations}
            onWriteRecovery={onWriteRecovery} onOpenDay={onOpenCoachingDay} experimentalFatigue={productFeatures().experimentalFatigue} />}</div>
        </div>}
        {section === "training" && <div className="trends-hub__tools">
          {tools.length > 1 ? <CategoryShortcuts label="분석 도구" items={tools} /> : tools.map(tool =>
            <CategoryCard key={tool.id} category={tool.category} variant="row" icon={tool.icon} title={tool.label} onClick={tool.onClick} />)}
          {fileAnalysisEnabled && <CategoryCard category="oracle" variant="row" icon={FileChartColumn} title="파일 분석" onClick={() => {
            setDetail("files"); onContextChange?.({ ...initialContext, section: "files" })
          }} />}
        </div>}
      </div>
    </div>
  )
}

/**
 * 적어 둔 수치가 추이에서 빠졌다는 사실을 화면이 직접 말한다 (Q1).
 *
 * 두 원인을 **따로** 보여주는 이유: 사용자가 할 수 있는 일이 정반대다.
 *  - 가져온 값: 출처별 분석 수용은 별도이며 재입력을 통한 우회를 유도하지 않는다
 *  - 출처 없음: 사용자가 할 수 있는 게 없다(앱 문제) → 행동을 요구하지 않는다
 * 뭉치면 "직접 적어 주세요"라며 불가능한 일을 요구하는 안내가 된다.
 *
 * 알릴 것이 없으면 아무것도 그리지 않는다. 빈 안내는 소음이다.
 */
function AnalysisExclusionNotice({ summary }: {
  readonly summary: {
    readonly excludedImported: number
    readonly excludedNoProvenance: number
  }
}) {
  const { excludedImported, excludedNoProvenance } = summary
  if (excludedImported === 0 && excludedNoProvenance === 0) return null

  return (
    <div
      data-testid="trends-analysis-exclusion"
      role="note"
      style={{
        marginTop: 12, padding: "8px 0",
        background: "transparent",
        fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6,
      }}
    >
      <InfoDisclosure title={[
        excludedImported > 0 ? `가져온 기록 ${excludedImported}개` : null,
        excludedNoProvenance > 0 ? `출처 미확인 ${excludedNoProvenance}개` : null,
      ].filter(Boolean).join(" · ") + " · 분석 제외 안내"}>
      {excludedImported > 0 && (
        <div data-testid="trends-excluded-imported">
          워치·앱에서 <b>가져온 일지 {excludedImported}개</b>에 포함된 외부 수치는 아직 분석에 넣지 않았어요.
          같은 일지에 직접 남긴 값은 항목별 기준에 따라 사용할 수 있어요.
          <br />
          일지에는 그대로 남아 있어요. 외부 수치를 분석에 연결할 준비 중이며, 같은 값을 다시 입력할 필요는 없어요.
        </div>
      )}
      {excludedNoProvenance > 0 && (
        <div
          data-testid="trends-excluded-no-provenance"
          style={{ marginTop: excludedImported > 0 ? 8 : 0 }}
        >
          <b>일지 {excludedNoProvenance}개</b>는 수치가 어디서 왔는지(직접 적은 값인지)
          기록이 없어서 추이에 넣지 못했어요. 예전 버전에서 저장했거나, 그 정보가 없는
          백업 파일에서 되돌린 일지예요.
          <br />
          일지 내용은 그대로 남아 있어요. 같은 내용을 다시 입력할 필요는 없어요.
        </div>
      )}
      </InfoDisclosure>
    </div>
  )
}
