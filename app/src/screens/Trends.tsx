import React from "react"
import { ArrowLeft, ArrowRight, Calculator } from "lucide-react"
import { useAppOverlayNavigation } from "../components/AppOverlayNavigation"
import { projectStructuredJournalObservations } from "../domain/journal-observation"
import { analysisExclusionSummary, loadEntries, todayISO } from "../domain/journal-store"
import { MonthlyTrendSection } from "./trends/MonthlyTrendSection"
import { FatigueExperimentPanel } from "./trends/FatigueExperimentPanel"
import { productFeatures } from "../domain/product-features"
import { GuidedEmptyState } from "../components/GuidedEmptyState"
import { TermHelp } from "../components/TermHelp"
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
import "./trends/trends-hub.css"

const ANALYSIS_SECTIONS = [
  { id: "summary", label: "훈련 요약" },
  { id: "distance", label: "훈련량" },
  { id: "mix", label: "훈련 구성" },
  { id: "monthly", label: "월별 변화" },
  { id: "files", label: "파일 분석" },
] as const
const ORACLE_SECTIONS = [
  { id: "training", label: "내 훈련" },
  { id: "profile", label: "러닝 취향" },
  { id: "library", label: "읽을거리" },
] as const
export type OracleHubSection = (typeof ORACLE_SECTIONS)[number]["id"]

export function Trends({ onBack, onWriteLog, onOpenPlan, onOpenOracle, onOpenRecordReading, onOpenRunningProfile, onOpenOracleLibrary, onOpenTrainingContent, onOpenCoachingDay, oracleV2Enabled = false, initialContext, initialOracleSection, onOracleSectionChange, onContextChange }: {
  readonly onBack?: (() => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
  readonly onOpenPlan?: (() => void) | undefined
  readonly onOpenOracle?: ((topic: OracleTopicId) => void) | undefined
  readonly onOpenRecordReading?: (() => void) | undefined
  readonly onOpenRunningProfile?: (() => void) | undefined
  readonly onOpenOracleLibrary?: (() => void) | undefined
  readonly onOpenTrainingContent?: (() => void) | undefined
  readonly onOpenCoachingDay?: ((date: string, entryId?: string) => void) | undefined
  readonly oracleV2Enabled?: boolean | undefined
  readonly initialContext?: AnalysisNavigation | undefined
  readonly initialOracleSection?: OracleHubSection | undefined
  readonly onOracleSectionChange?: ((section: OracleHubSection) => void) | undefined
  readonly onContextChange?: ((context: AnalysisNavigation) => void) | undefined
}) {
  const navigation = useAppOverlayNavigation()
  const [section, setSection] = React.useState<OracleHubSection>(initialOracleSection ?? "training")
  const [detail, setDetail] = React.useState<AnalysisSection>(initialContext?.section ?? "summary")
  React.useEffect(() => { if (initialOracleSection) setSection(initialOracleSection) }, [initialOracleSection])
  React.useEffect(() => {
    if (!initialContext) return
    setSection("training")
    setDetail(initialContext.section)
  }, [initialContext?.section, initialContext?.metric, initialContext?.savedDate])
  const fileAnalysisEnabled = fileAnalysisFormats().length > 0
  const [entryRevision, setEntryRevision] = React.useState(0)
  React.useEffect(() => {
    const refresh = () => setEntryRevision(value => value + 1)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => window.removeEventListener("trainoracle:account-journals-changed", refresh)
  }, [])
  const entries = React.useMemo(() => loadEntries(), [entryRevision])
  const accountEntries = React.useMemo(() => readCurrentConfirmedAccountJournalProjection(), [entryRevision])
  const pendingFileCount = React.useMemo(() => {
    const currentIds = new Set(accountEntries.map(entry => entry.id))
    return readAccountJournalProjection().filter(entry => entry.kind === "post-session" && entry.fileObservation
      && !currentIds.has(entry.id)).length
  }, [accountEntries])
  const observations = React.useMemo(() => projectStructuredJournalObservations(entries), [entries])
  const today = todayISO()
  const planState = loadPlanBetaState()
  const planFrame = planState?.activePlan.frame
  const planVisibleLength = planFrame === undefined
    ? undefined
    : "projectionLengthDays" in planFrame
      ? planFrame.projectionLengthDays ?? planFrame.lengthDays
      : planFrame.lengthDays
  const planWindow = activePlanDateWindow(planState?.intake.startDate, planVisibleLength)
  const isEmpty = observations.length === 0
  /**
   * 값을 적었는데도 추이에 못 들어간 일지 개수 (Q1).
   * 화면이 침묵하면 사용자는 자기가 적은 값이 왜 그래프에 없는지 알 수 없다.
   * 이 화면의 실제 관문(eligibleMetricValue)에서 가져온 값과 출처 없는 값이
   * 0km로 떨어지는 것을 실행으로 확인한 뒤 붙였다.
   */
  const exclusion = React.useMemo(() => analysisExclusionSummary(), [entryRevision])

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[TRENDS] mode=${isEmpty ? "empty" : "data"} observations=${observations.length}`)
    }
  }, [isEmpty, observations.length])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TrendsHeader onBack={onBack} />
      {navigation?.openPaceCalculator && <button type="button" className="plan-text-action" onClick={() => navigation.openPaceCalculator?.()}>
        <Calculator size={18} aria-hidden="true" /> 페이스 계산
      </button>}
      <div className="trends-motion-stage">
        <div className="trends-hub__sections" role="group" aria-label="오라클 항목">
          {ORACLE_SECTIONS.map(item => (
            <button key={item.id} type="button" aria-pressed={section === item.id}
              onClick={() => { setSection(item.id); onOracleSectionChange?.(item.id) }}>{item.label}</button>
          ))}
        </div>
        {section === "training" && <div className="trends-hub__drilldowns" role="group" aria-label="훈련 분석 자세히 보기">
          {ANALYSIS_SECTIONS.map(item => <button key={item.id} type="button" aria-pressed={detail === item.id}
            onClick={() => {
              setDetail(item.id)
              onContextChange?.({ ...initialContext, section: item.id })
            }}>{item.label}</button>)}
        </div>}
        {initialContext?.savedDate && section === "training" && detail === initialContext.section && (
          <p className="trends-hub__saved-context" role="status">
            {initialContext.savedDate}에 저장한 {initialContext.metric === "PAIN_MAX" ? "통증을" : initialContext.metric === "MOOD" ? "기분을" : "거리를"} 월별 기록과 함께 볼 수 있어요.
          </p>
        )}
        {pendingFileCount > 0 && !(section === "training" && detail === "files") && (
          <div className="trends-hub__notice" role="status">
            <span>파일 기록 {pendingFileCount}건 · 확인 전 분석에서 제외</span>
            <button type="button" onClick={() => { setSection("training"); setDetail("files"); onOracleSectionChange?.("training"); onContextChange?.({ ...initialContext, section: "files" }) }}>확인하기</button>
          </div>
        )}
        {section === "training" && detail === "files" && (
          <>
            {fileAnalysisEnabled ? <FileAnalysisPanel entries={accountEntries} pendingVerificationCount={pendingFileCount} onOpenPlan={onOpenPlan} /> : (
              <div className="trends-hub__empty">
                <h2>파일 분석은 준비 중이에요</h2>
                <p>현재는 일지에 직접 남긴 값으로 훈련량과 변화를 볼 수 있어요.</p>
                {pendingFileCount > 0 && <p role="status">파일 기록 {pendingFileCount}건은 보관돼 있으며, 확인 전 분석에서 제외해요.</p>}
              <button type="button" onClick={() => setDetail("distance")}>훈련량 보기</button>
              </div>
            )}
            {fileAnalysisEnabled && !accountEntries.some(entry => entry.kind === "post-session" && entry.fileObservation) && pendingFileCount === 0 && (
              <div className="trends-hub__empty">
                <h2>분석할 파일 기록이 없어요</h2>
                <p>확인된 운동 파일이 있으면 구간과 훈련 내용을 볼 수 있어요.</p>
                {onWriteLog && <button type="button" onClick={onWriteLog}>기록 추가하기</button>}
              </div>
            )}
            <div style={{ padding: "0 20px" }}><AnalysisExclusionNotice summary={exclusion} /></div>
          </>
        )}
        {section === "profile" && <section className="trends-record-reading" aria-labelledby="trends-preferences-title">
          <div><p>러닝 취향 · 선택 사항</p><h2 id="trends-preferences-title">내가 좋아하는 달리기</h2>
            <p>{oracleV2Enabled
              ? "계획 선호 3문항에 답하면 취향을 정리해 볼 수 있어요. 답하지 않아도 훈련 요약과 읽을거리를 둘러볼 수 있어요."
              : "기존 러닝 프로필을 확인할 수 있어요. 훈련 분석과 읽을거리도 함께 둘러볼 수 있어요."}</p></div>
          {onOpenRunningProfile && <button type="button" onClick={onOpenRunningProfile}>러닝 취향 보기<ArrowRight size={18} aria-hidden="true" /></button>}
        </section>}
        {section === "profile" && onOpenRecordReading && <section className="trends-record-reading">
          <div><p>내 기록 · 선택 사항</p><h2>최고기록에 담긴 이야기를 읽어요</h2></div>
          <button type="button" onClick={onOpenRecordReading}>최고기록으로 풀이하기<ArrowRight size={18} aria-hidden="true" /></button>
        </section>}
        {section === "library" && <section className="trends-record-reading" aria-labelledby="trends-library-title">
          {oracleV2Enabled && onOpenOracleLibrary ? <>
            <div><p>훈련 · 기록 · 대회 · 돌아보기 · 배우기</p><h2 id="trends-library-title">궁금한 주제를 골라 읽어요</h2>
              <p>개인 자료가 있으면 확인한 사실과 출처를 보여주고, 없거나 확인할 수 없으면 그 상태와 일반 안내를 구분해요.</p>
              <p className="trends-record-reading__meta">읽을거리 56편 · 8개 주제 묶음</p></div>
            <button type="button" onClick={onOpenOracleLibrary}>읽을거리 살펴보기<ArrowRight size={18} aria-hidden="true" /></button>
          </> : <>
            <div><p>훈련 배우기</p><h2 id="trends-library-title">달리기 원리와 용어를 살펴봐요</h2>
              <p>훈련과 기록을 이해하는 데 도움이 되는 기본 내용을 확인할 수 있어요.</p></div>
            {onOpenTrainingContent && <button type="button" onClick={onOpenTrainingContent}>훈련 배우기<ArrowRight size={18} aria-hidden="true" /></button>}
          </>}
        </section>}
        {section === "training" && detail === "summary" && isEmpty && (
          <>
            <div style={{ padding: "0 20px" }}>
              <div className="trends-record-reading__journal">
                <p>훈련 일지도 남기면 계획과 실제 느낌을 함께 볼 수 있어요.</p>
                <button type="button" onClick={onWriteLog}>{entries.length > 0 ? "기록 더 남기기" : "첫 기록 남기기"}<ArrowRight size={16} aria-hidden="true" /></button>
              </div>
              {!onOpenRecordReading && <GuidedEmptyState
                title={entries.length > 0 ? "분석 가능한 기록이 아직 없어요" : "분석할 기록이 아직 없어요"}
                description={<>거리·시간·RPE<TermHelp term="rpe" />가 있는 기록이 필요해요.</>}
                actionLabel={entries.length > 0 ? "기록 더 남기기" : "첫 기록 남기기"}
                onAction={onWriteLog}
              />}
              <InfoDisclosure title="어떤 기록을 분석하나요?">
                <PersonalOraclePanel observations={observations} today={today} planState={planState} />
              </InfoDisclosure>
              {onOpenOracle && <OracleTopicGrid onSelectTopic={onOpenOracle} title="기록으로 알아보기" compact />}
            </div>
          </>
        )}
        {section === "training" && detail === "summary" && !isEmpty && (
          <>
            <PersonalOraclePanel observations={observations} today={today} planState={planState} />
            {onOpenOracle && <div className="trends-hub__explore">
              <OracleTopicGrid onSelectTopic={onOpenOracle} title="다른 주제 살펴보기" compact />
            </div>}
          </>
        )}
        {section === "training" && detail === "summary" && <div className="trends-hub__coaching">
          <HomeCoachingSummary revision={entryRevision} onOpenDay={onOpenCoachingDay} onOpenPlan={onOpenPlan} />
        </div>}
        {section === "training" && detail === "distance" && <CumulativeDistancePanel observations={observations} today={today} planWindow={planWindow} mode="full" />}
        {section === "training" && detail === "mix" && <EnergySystemLedgerPanel observations={observations} today={today} planState={planState} mode="full" />}
        {section === "training" && detail === "monthly" && <MonthlyTrendSection observations={observations} today={today} initialMetric={initialContext?.metric} />}
        {section === "training" && detail === "summary" && onOpenOracle && <div className="trends-hub__explore"><OracleResume onOpenTopic={onOpenOracle} /></div>}
        {section === "training" && detail !== "files" && <div style={{ padding: "0 20px" }}>
          <AnalysisExclusionNotice summary={exclusion} />
        </div>}
        {section === "training" && detail === "summary" && <div style={{ padding: "0 20px" }}>
          <InfoDisclosure title="분석 기준">
            <p>확인된 기록만 분석해요. 개인 메모는 읽지 않아요.</p>
            <p>기록을 정리한 결과이며, 계획·안전 판단은 자동으로 바꾸지 않아요.</p>
          </InfoDisclosure>
        </div>}
        {section === "training" && detail === "summary" && productFeatures().experimentalFatigue && <FatigueExperimentPanel />}
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
        marginTop: 14, padding: "10px 12px",
        border: "1px solid var(--line)", background: "transparent",
        fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6,
      }}
    >
      <InfoDisclosure title={[
        excludedImported > 0 ? `가져온 기록 ${excludedImported}개` : null,
        excludedNoProvenance > 0 ? `출처 확인이 필요한 기록 ${excludedNoProvenance}개` : null,
      ].filter(Boolean).join(" · ") + " · 분석에서 제외된 항목 안내"}>
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

function TrendsHeader({ onBack }: { readonly onBack?: (() => void) | undefined }) {
  return (
    <div style={{
      padding: "12px 16px",
      borderBottom: "1px solid var(--line)",
      display: "grid",
      gridTemplateColumns: "64px minmax(0, 1fr) 64px",
      alignItems: "center",
      background: "var(--bg)",
    }}>
      <button type="button" onClick={onBack} style={{
        background: "transparent",
        border: 0,
        cursor: "pointer",
        padding: 4,
        minWidth: 64,
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--ink-2)",
      }}>
        <ArrowLeft aria-hidden="true" size={16} />
        <span style={{ whiteSpace: "nowrap" }}>뒤로</span>
      </button>
      <h1 style={{
        minWidth: 0,
        fontFamily: "var(--mono)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink)",
        textAlign: "center",
        margin: 0,
      }}>오라클</h1>
      <div aria-hidden="true" />
    </div>
  )
}
