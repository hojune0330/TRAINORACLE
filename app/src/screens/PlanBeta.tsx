import React from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, accountPlansEnabled } from "../domain/account/account-plan-service"
import { ensureAccountPlanHistory } from "../domain/account/account-plan-domain"
import { useAccountPlanRuntime } from "./plan-beta/useAccountPlanRuntime"
import { AccountPlanHistoryControls, AccountPlanStorageControls } from "./plan-beta/AccountPlanStorageControls"
import { AccountPlanHistoricalView } from "./plan-beta/AccountPlanHistoricalView"
import { AccountPlanLegacyRecovery } from "./plan-beta/AccountPlanLegacyRecovery"
import { materializeAccountPlan, accountPlanCapacity, type AccountPlanEntry } from "../domain/account/account-plan-document-schema"
import type {
  PlanGenerationSuccess,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  evaluatePlanSafety,
  generatePlanFromDraft,
} from "../domain/plan-beta-flow"
import type {
  PlanAthleteEvidence,
  PlanCurrentCheck,
  PlanDraftGeneration,
} from "../domain/plan-beta-flow"
import {
  loadPlanBetaState,
  loadPreviousIntake,
  savePlanBetaState,
  readPlanBetaStateFromStorage,
  activePlanBetaStorageKey,
} from "../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../domain/plan-beta-store"
import type { JournalEntryType } from "./log-entry/shared"
import { PlanActiveState } from "./plan-beta/PlanActiveState"
import { PlanCandidates } from "./plan-beta/PlanCandidates"
import { PlanIntake } from "./plan-beta/PlanIntake"
import type { IntakeStep } from "./plan-beta/PlanIntake"
import { NotationReader } from "./plan-beta/NotationReader"
import { RaceDatePreview } from "./plan-beta/RaceDatePreview"
import {
  saveSelectedPlanCandidate,
} from "./plan-beta/plan-selection"
import type { CandidateSelection } from "./plan-beta/plan-selection"
import { planErrorMessage } from "./plan-beta/plan-feedback"
import { loadAthleteRecords } from "../domain/athlete-records"
import { InstantPlanEntryForm } from "../components/instant-plan/InstantPlanEntryForm"
import type { InstantPlanEntry } from "../domain/instant-plan-contract"
import { prepareInstantPlanEntry } from "../domain/instant-plan-entry"
import { prepareInstantIntake } from "./plan-beta/instant-plan-intake"
import type { CandidatePrescriptionBinding } from "../domain/plan-candidate-prescription"
import { samePlanSessionTarget, type PlanSessionTarget, type CandidateSessionTargets } from "../domain/plan-session-target"
import {
  eventGroupForDistance,
  firstUnansweredQuickStep,
  previousIntakeStep,
  QUICK_INTAKE_DEFAULTS,
  withQuickDefaults,
} from "./plan-beta/plan-intake-navigation"
import { PlanBlockedGuide } from "./plan-beta/PlanBlockedGuide"
import {
  backupActivePlanToServer,
  loadLatestPlanFromServer,
  planCloudBackupEnabled,
} from "../domain/account/plan-cloud-backup"
import type { PlanCloudPersistenceState } from "../domain/account/plan-cloud-backup"
import type { PlannedSessionLogDraft } from "../domain/planned-session-link"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../hooks/useOrderedStepMotion"
import { resolvePlanMethodChange } from "../domain/plan-method-selection"
import { todayISO } from "../domain/journal-store"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { localAccountScopeSnapshot } from "../domain/account/local-account-scope"
import { AdjustedPlanSchedule } from "./plan-beta/AdjustedPlanSchedule"
import { AdjustedPlanEditFlow } from "./plan-beta/AdjustedPlanEditFlow"
import { matchingAdjustmentEntry } from "./plan-beta/adjustment-entry"
import { AdjustedPlanNextFlow, readOperatingAdjustedEvidence } from "./plan-beta/AdjustedPlanNextFlow"
import { exportAdjustedPlanBackup } from "../domain/adjusted-plan-backup"
import { AdjustedPlanImport } from "./plan-beta/AdjustedPlanImport"
import { AdjustedPlanScheduleV3 } from "./plan-beta/AdjustedPlanScheduleV3"
import { MultiAdjustedPlanScheduleV3 } from "./plan-beta/MultiAdjustedPlanScheduleV3"
import { RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "../domain/adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "../domain/selected-multi-adjusted-plan-v3"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "../domain/adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "../domain/selected-adjusted-plan-v3"
import { AdjustedPlanNextFlowV3 } from "./plan-beta/AdjustedPlanNextFlowV3"
import { matchingAdjustmentEntryV3, type PlanAdjustmentResolverV3, type AdjustmentEntryV3 } from "./plan-beta/adjustment-entry-v3"
import { AdjustedPlanEditFlowV3 } from "./plan-beta/AdjustedPlanEditFlowV3"
import { MultiAdjustedPlanEditFlowV3 } from "./plan-beta/MultiAdjustedPlanEditFlowV3"
import { MultiAdjustedPlanNextFlowV3 } from "./plan-beta/MultiAdjustedPlanNextFlowV3"
import { MultiPlanCloudControlsV3 } from "./plan-beta/MultiPlanCloudControlsV3"
import { readCurrentMultiRestoreReviewV3 } from "../domain/multi-plan-restore-review-v3"
import { matchingMultiAdjustmentEntryV3, type PlanMultiAdjustmentResolverV3, type MultiAdjustmentEditorEntryV3 } from "./plan-beta/multi-adjustment-entry-v3"
const readOperatingV3Evidence = () => RETAINED_ADJUSTED_PLAN_EVIDENCE_V3
const readOperatingMultiV3Evidence = () => RETAINED_MULTI_ADJUSTED_EVIDENCE_V3

type AdjustmentEntry = Pick<React.ComponentProps<typeof AdjustedPlanEditFlow>, "seed" | "readReview" | "locks">
export type PlanAdjustmentResolver = (context: {
  generated: PlanGenerationSuccess; gate: SafetyGateDecision; intake: PlanBetaIntake;
  athleteEvidence: PlanAthleteEvidence; currentCheck: PlanCurrentCheck;
  candidateId: string; startDate: string;
}) => AdjustmentEntry | null

const AthleteRecords = React.lazy(() => import("./AthleteRecords").then(module => ({ default: module.AthleteRecords })))

const INTAKE_MOTION_ORDER: readonly IntakeStep[] = [
  "goal",
  "experience",
  "days",
  "safety",
  "preview",
  "division",
  "focus",
  "template",
  "frame-length",
  "training-time",
  "two-a-day",
  "race-date",
]

/** 다듬기에서 열 수 있는 단계. 결과 화면에서 하나씩 열고, 고르면 바로 결과로 돌아간다. */
const REFINE_STEPS: readonly IntakeStep[] = [
  "goal",
  "experience",
  "days",
  "division",
  "focus",
  "template",
  "frame-length",
  "training-time",
  "two-a-day",
  "race-date",
]

function AccountPlanHistoryList({ plans }: { plans: AccountPlanEntry[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [visibleCount, setVisibleCount] = React.useState(10)
  return <>
    {plans.slice(0, visibleCount).map(p => <details key={p.planId} open={expanded === p.planId}
      onToggle={event => {
        const open = event.currentTarget.open
        setExpanded(current => open ? p.planId : current === p.planId ? null : current)
      }}>
      <summary>{p.archivedAt!.slice(0, 10)} 보관</summary>
      {expanded === p.planId && <AccountPlanHistoricalView packet={materializeAccountPlan(p)} verificationPending={p.snapshot.evidence !== null} />}
    </details>)}
    {visibleCount < plans.length && <button type="button" onClick={() => setVisibleCount(count => count + 10)}>
      보관한 계획 더 보기 ({Math.min(visibleCount, plans.length)}/{plans.length})
    </button>}
  </>
}

export function PlanBeta(props: React.ComponentProps<typeof PlanBetaContent>) {
  const service = accountPlanService(), { view, retry } = useAccountPlanRuntime(service)
  const [error, setError] = React.useState<string | null>(null)
  const [archiveReview, setArchiveReview] = React.useState<{ fingerprint: string; planId: string } | null>(null)
  const [historyPanel, setHistoryPanel] = React.useState({ service, open: false, paused: false })
  const historyOpen = historyPanel.service === service && historyPanel.open
  const historyPaused = historyPanel.service === service && historyPanel.paused
  React.useEffect(() => { setArchiveReview(null); setError(null) }, [service])
  const historical = view?.currentPlan?.kind === "evidence_required" ? view.currentPlan.packet : null
  const collection = view && "historyLoaded" in view ? view : null
  const needsHistoryForNewPlan = !!collection && !collection.currentPlan && !collection.historyLoaded && collection.totalPlans > 0
  React.useEffect(() => {
    if (needsHistoryForNewPlan && !historyPaused && collection?.historyStatus === "IDLE") void ensureAccountPlanHistory()
  }, [needsHistoryForNewPlan, historyPaused, collection?.historyStatus])
  const historyCount = collection?.totalPlans ?? view?.confirmedDocument?.data.plans.length ?? 0
  const loadHistory = () => {
    if (accountPlanService() !== service) return
    setHistoryPanel({ service, open: historyOpen, paused: false })
    void ensureAccountPlanHistory()
  }
  const cancelHistoryRequest = service && "cancelHistory" in service && typeof service.cancelHistory === "function" ? service.cancelHistory : undefined
  const cancelHistory = cancelHistoryRequest ? () => {
    if (accountPlanService() !== service) return
    setHistoryPanel({ service, open: historyOpen, paused: true })
    cancelHistoryRequest()
  } : undefined
  const historyControls = collection && <AccountPlanHistoryControls status={collection.historyStatus}
    progress={collection.historyProgress}
    onRetry={loadHistory} onCancel={cancelHistory} />
  return <div className="account-plan-runtime">
    {view && <AccountPlanStorageControls status={view.status} evidenceRequired={historical !== null}
      capacity={!collection && view.document ? accountPlanCapacity(view.document) : undefined}
      collectionCount={collection?.totalPlans}
      browserSupported={collection?.browserSupported}
      retryAvailable={!collection?.legacyPending}
      onRetry={() => { void (view.status === "PENDING" ? retry() : service?.hydrate()) }}
      onUseServer={collection?.legacyPending ? undefined : () => { if (service && view.fingerprint) void service.useServerCurrent(view.fingerprint).then(result => {
        if (accountPlanService() === service) setError(result === "ACCOUNT" ? null : "서버 계획을 확인하지 못했어요. 두 수정본은 그대로 보존돼 있어요.")
      }) }} />}
    {error && <p role="alert">{error}</p>}
    {collection?.currentPlan && !historyOpen && ["LOADING", "FAILED"].includes(collection.historyStatus) &&
      <section className="account-plan-storage" aria-label="이전 계획 확인">{historyControls}</section>}
    {collection?.legacyPending && service && "recoverLegacyPending" in service && <AccountPlanLegacyRecovery service={service} view={collection} />}
    {collection?.migrationRequired && !collection.legacyPending && <section aria-label="기존 계획 보관 방식 이전">
      <p>기존 계정 계획을 계획별 저장 방식으로 옮길 수 있어요. 이전 원본은 삭제하지 않아요.</p>
      <button type="button" disabled={!["READY", "EMPTY"].includes(collection.status)} onClick={async () => {
        if (!service || !("migrateLegacy" in service)) return
        const result = await service.migrateLegacy()
        if (accountPlanService() === service) setError(result === "ACCOUNT" ? null : planErrorMessage(`ACCOUNT_PLAN_${result}`))
      }}>원본 유지하고 저장 방식 이전</button>
    </section>}
    {view?.currentPlan && view.fingerprint && <button type="button" disabled={view.status !== "READY"} onClick={() =>
      setArchiveReview({ fingerprint: view.fingerprint!, planId: view.currentPlan!.planId })}>현재 계획 보관</button>}
    {archiveReview && <section role="alertdialog" aria-label="현재 계획 보관 확인">
      <p>원본과 진행 기록을 보관하고 계정의 현재 계획을 끝낼까요?</p>
      <button type="button" onClick={() => setArchiveReview(null)}>취소</button>
      <button type="button" onClick={async () => {
        if (!service) return
        const result = await service.mutate({ kind: "ARCHIVE", planId: archiveReview.planId }, archiveReview.fingerprint)
        if (accountPlanService() !== service) return
        setArchiveReview(null); setError(result === "ACCOUNT" ? null : planErrorMessage(`ACCOUNT_PLAN_${result}`))
      }}>보관하고 현재 계획 끝내기</button>
    </section>}
    {collection?.legacyPending ? collection.currentPlan?.packet && <AccountPlanHistoricalView packet={collection.currentPlan.packet} verificationPending /> : needsHistoryForNewPlan ? <section className="account-plan-storage" aria-label="이전 계획 확인">
      {!historyOpen && historyControls}
    </section> : historical ? <AccountPlanHistoricalView packet={historical} /> : <PlanBetaContent {...props} />}
    {historyCount > (view?.currentPlan ? 1 : 0) && <details className="account-plan-history" open={historyOpen} onToggle={event => {
      const open = event.currentTarget.open
      setHistoryPanel({ service, open, paused: historyPaused })
      if (open && accountPlanService() === service && !historyPaused) void ensureAccountPlanHistory()
    }}><summary>보관한 계획 원본</summary>
      {historyOpen && <>
        {historyControls}
        {(!collection || collection.historyLoaded) && <AccountPlanHistoryList key={localAccountScopeSnapshot()}
          plans={view?.confirmedDocument?.data.plans.filter(p => p.archivedAt) ?? []} />}
      </>}
    </details>}
  </div>
}

function PlanBetaContent(props: Omit<React.ComponentProps<typeof LegacyPlanBeta>, "onAdjustedStored"> & {
  readonly readAdjustedEvidence?: React.ComponentProps<typeof AdjustedPlanNextFlow>["readEvidence"]
  readonly readAdjustedEvidenceV3?: () => readonly RetainedAdjustedPlanEvidenceV3[]
  readonly readMultiAdjustedEvidenceV3?: () => readonly RetainedMultiAdjustedEvidenceV3[]
  readonly readMultiRestoreReviewV3?: React.ComponentProps<typeof MultiPlanCloudControlsV3>["readRestoreReview"]
  readonly adjustmentResolverV3?: PlanAdjustmentResolverV3
}) {
  const readEvidence = props.readAdjustedEvidence ?? readOperatingAdjustedEvidence
  const readV3Evidence = props.readAdjustedEvidenceV3 ?? readOperatingV3Evidence
  const readMultiV3Evidence = props.readMultiAdjustedEvidenceV3 ?? readOperatingMultiV3Evidence
  const readCurrent = React.useCallback(() => readPlanBetaStateFromStorage(readEvidence(), readV3Evidence(), readMultiV3Evidence()), [readEvidence, readV3Evidence, readMultiV3Evidence])
  const [read, setRead] = React.useState(readCurrent)
  const [nextOpen, setNextOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  const prepareNext = async (kind: typeof read.kind) => {
    const scope = localAccountScopeSnapshot()
    const expected = read.kind === "adjusted_loaded" || read.kind === "adjusted_v3_loaded" || read.kind === "multi_adjusted_v3_loaded"
      ? read.state.contentFingerprint : null
    const ready = accountPlansEnabled() ? await ensureAccountPlanHistory() : true
    if (localAccountScopeSnapshot() !== scope) return
    if (!ready) return
    const current = readCurrent(); setRead(current)
    if ((current.kind === "adjusted_loaded" || current.kind === "adjusted_v3_loaded" || current.kind === "multi_adjusted_v3_loaded")
      && current.kind === kind && current.state.contentFingerprint === expected) setNextOpen(true)
  }
  React.useEffect(() => {
    const refresh = () => { setImportOpen(false); setNextOpen(false); setRead(readCurrent()); setRevision(value => value + 1) }
    const onStorage = (event: StorageEvent) => {
      if (event.key === null) { refresh(); return }
      if (event.key !== activePlanBetaStorageKey()) return
      // Keep an in-progress legacy candidate mounted; its save gate checks the current stored plan.
      setRead(readCurrent())
    }
    const unsubscribe = onLocalJournalScopeChange(refresh)
    const onAccountPlan = () => setRead(readCurrent())
    window.addEventListener(ACCOUNT_PLAN_EVENT, onAccountPlan)
    window.addEventListener("storage", onStorage)
    return () => { unsubscribe(); window.removeEventListener("storage", onStorage); window.removeEventListener(ACCOUNT_PLAN_EVENT, onAccountPlan) }
  }, [readCurrent])
  if (read.kind === "multi_adjusted_v3_loaded" && nextOpen && !importOpen) return <MultiAdjustedPlanNextFlowV3
    key={`${localAccountScopeSnapshot()}:${read.state.contentFingerprint}`}
    loaded={read} resolver={props.multiAdjustmentResolverV3} readEvidence={readMultiV3Evidence}
    onBack={() => { setNextOpen(false); setRead(readCurrent()) }}
    onSaved={() => { setNextOpen(false); setRead(readCurrent()) }} />
  if (read.kind === "multi_adjusted_v3_loaded" && !importOpen) return <MultiAdjustedPlanScheduleV3
    key={`${localAccountScopeSnapshot()}:${read.state.selection.contentFingerprint}`}
    loaded={{ ...read, kind: "loaded" }} readEvidence={readMultiV3Evidence} onStoredChange={() => setRead(readCurrent())} onImportPlan={() => setImportOpen(true)}
    onPrepareNext={() => { void prepareNext("multi_adjusted_v3_loaded") }}
    returnToSession={props.returnToSession} onWritePlannedSessionLog={props.onWritePlannedSessionLog === undefined ? undefined : draft => {
      const current = readCurrent()
      if (current.kind !== "multi_adjusted_v3_loaded" || current.state.contentFingerprint !== read.state.contentFingerprint) {
        setRead(current); return
      }
      props.onWritePlannedSessionLog?.(draft)
    }} />
  if (read.kind === "adjusted_v3_loaded" && nextOpen && !importOpen) return <AdjustedPlanNextFlowV3
    key={`${localAccountScopeSnapshot()}:${read.state.contentFingerprint}`}
    loaded={read} resolver={props.adjustmentResolverV3} readEvidence={readV3Evidence}
    onBack={() => { setNextOpen(false); setRead(readCurrent()) }}
    onSaved={() => { setNextOpen(false); setRead(readCurrent()) }} />
  if (read.kind === "adjusted_v3_loaded" && !importOpen) return <AdjustedPlanScheduleV3
    key={`${localAccountScopeSnapshot()}:${read.state.selection.contentFingerprint}`}
    loaded={{ ...read, kind: "loaded" }} readEvidence={readV3Evidence} onStoredChange={() => setRead(readCurrent())}
    onPrepareNext={() => { void prepareNext("adjusted_v3_loaded") }}
    onImportPlan={() => setImportOpen(true)} returnToSession={props.returnToSession} onWritePlannedSessionLog={props.onWritePlannedSessionLog === undefined ? undefined : draft => {
      const current = readCurrent()
      if (current.kind !== "adjusted_v3_loaded" || current.state.contentFingerprint !== read.state.contentFingerprint) {
        setRead(current); return
      }
      props.onWritePlannedSessionLog?.(draft)
    }} />
  if (importOpen) return <AdjustedPlanImport readEvidence={readEvidence} readEvidenceV3={readV3Evidence} readMultiEvidenceV3={readMultiV3Evidence}
    onBack={() => { setImportOpen(false); setRead(readCurrent()) }} />
  if (read.kind === "adjusted_loaded" && nextOpen) return <AdjustedPlanNextFlow
    key={`${localAccountScopeSnapshot()}:${read.state.contentFingerprint}`}
    loaded={read} adjustmentResolver={props.adjustmentResolver} readEvidence={readEvidence}
    onBack={() => { setNextOpen(false); setRead(readCurrent()) }}
    onSaved={() => { setNextOpen(false); setRead(readCurrent()) }} />
  if (read.kind === "adjusted_loaded") return <AdjustedPlanSchedule
    readEvidence={readEvidence}
    key={`${localAccountScopeSnapshot()}:${read.state.selection.contentFingerprint}`}
    onStoredChange={() => setRead(readCurrent())}
    onExportPlan={() => exportAdjustedPlanBackup(read.state.contentFingerprint, readEvidence())}
    onImportPlan={() => setImportOpen(true)}
    onPrepareNext={() => { void prepareNext("adjusted_loaded") }}
    loaded={read} onWritePlannedSessionLog={props.onWritePlannedSessionLog === undefined ? undefined : draft => {
      const current = readCurrent()
      if (current.kind !== "adjusted_loaded" || current.state.contentFingerprint !== read.state.contentFingerprint) {
        setRead(current)
        return
      }
      props.onWritePlannedSessionLog?.(draft)
    }} returnToSession={props.returnToSession} />
  if (read.kind === "invalid" || read.kind === "storage_error") return <section>
    <h1>저장된 계획을 확인하지 못했어요</h1>
    <p role="alert">계획을 지우거나 새 계획으로 바꾸지 않았어요. 다시 확인해 주세요.</p>
    <button type="button" onClick={() => setRead(readCurrent())}>다시 확인</button>
  </section>
  return <><LegacyPlanBeta key={revision} {...props} onAdjustedStored={() => setRead(readCurrent())} />
    {read.kind === "missing" && <MultiPlanCloudControlsV3 fingerprint={null} readEvidence={readMultiV3Evidence}
      readRestoreReview={props.readMultiRestoreReviewV3 ?? readCurrentMultiRestoreReviewV3} onCurrentRestored={() => setRead(readCurrent())} />}
    <button className="plan-file-import" type="button" onClick={() => setImportOpen(true)}>개인 계획 파일 불러오기</button></>
}

function LegacyPlanBeta({
  onWriteLog,
  onManageRecords,
  onWritePlannedSessionLog,
  returnToSession,
  adjustmentResolver,
  adjustmentResolverV3,
  multiAdjustmentResolverV3,
  onAdjustedStored,
}: {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onManageRecords?: () => void
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
  readonly adjustmentResolver?: PlanAdjustmentResolver
  readonly adjustmentResolverV3?: PlanAdjustmentResolverV3
  readonly multiAdjustmentResolverV3?: PlanMultiAdjustmentResolverV3
  readonly onAdjustedStored: () => void
}) {
  const [adjusting, setAdjusting] = React.useState<{ entry: AdjustmentEntry; revision: number } | null>(null)
  const [adjustingV3, setAdjustingV3] = React.useState<{ entry: AdjustmentEntryV3; revision: number } | null>(null)
  const [adjustingMultiV3, setAdjustingMultiV3] = React.useState<{ entry: MultiAdjustmentEditorEntryV3; revision: number } | null>(null)
  const [stored, setStored] = React.useState<PlanBetaState | null>(
    () => loadPlanBetaState(),
  )
  React.useEffect(() => {
    const refresh = () => setStored(loadPlanBetaState())
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    return () => window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh)
  }, [])
  const [cloudRestorePending, setCloudRestorePending] = React.useState(
    stored === null && planCloudBackupEnabled(),
  )
  const [cloudPersistence, setCloudPersistence] = React.useState<PlanCloudPersistenceState>(
    planCloudBackupEnabled() ? "CHECKING" : "DEVICE_ONLY",
  )
  const cloudBackupAttempt = React.useRef(0)
  const previousIntake = React.useState(() => loadPreviousIntake())[0]
  const [instantEntryOpen, setInstantEntryOpen] = React.useState(previousIntake === null && stored === null)
  const [instantEntry, setInstantEntry] = React.useState<InstantPlanEntry | undefined>()
  const [instantEntryError, setInstantEntryError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Partial<PlanBetaIntake>>(
    previousIntake ?? {},
  )
  const [step, setStep] = React.useState<IntakeStep>(
    () => firstUnansweredQuickStep(previousIntake ?? {}),
  )
  /** 결과 화면의 "다듬기"에서 연 질문인지. 고르면 결과로 바로 돌아간다. */
  const [refining, setRefining] = React.useState(false)
  const [generated, setGenerated] = React.useState<PlanGenerationSuccess | null>(
    null,
  )
  const [generatedIntake, setGeneratedIntake] =
    React.useState<PlanBetaIntake | null>(null)
  const [gate, setGate] = React.useState<SafetyGateDecision | null>(null)
  const [generatedEvidence, setGeneratedEvidence] = React.useState<PlanAthleteEvidence | null>(null)
  const [targetRaceDate, setTargetRaceDate] = React.useState("")
  const [racePreview, setRacePreview] = React.useState<
    Extract<PlanDraftGeneration, { readonly kind: "preview_only" }> | null
  >(null)
  const [blocked, setBlocked] = React.useState(false)
  const [currentCheck, setCurrentCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const [retrySelection, setRetrySelection] = React.useState<CandidateSelection | null>(null)
  const [selectionSaving, setSelectionSaving] = React.useState(false)
  const selectionWrite = React.useRef(false)
  const [notationReaderOpen, setNotationReaderOpen] = React.useState(false)
  const [celebrateActivePlan, setCelebrateActivePlan] = React.useState(false)
  const [athleteRecords, setAthleteRecords] = React.useState(() => loadAthleteRecords())
  const [recordsOpen, setRecordsOpen] = React.useState(false)
  const [recordReturnCount, setRecordReturnCount] = React.useState(0)
  const [candidateStartDate, setCandidateStartDate] = React.useState(todayISO)
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  const [detailedSessionTarget, setDetailedSessionTarget] = React.useState<PlanSessionTarget | null>(null)
  const [candidateSessionTargets, setCandidateSessionTargets] = React.useState<CandidateSessionTargets>({})
  const [comparisonRecordId, setComparisonRecordId] = React.useState<string | null>(null)
  const [recordConfirmationPending, setRecordConfirmationPending] = React.useState(false)
  const draftRevision = React.useRef(0)
  React.useEffect(() => () => { draftRevision.current += 1 }, [])
  const [prescriptionBinding, setPrescriptionBinding] = React.useState<
    Omit<CandidatePrescriptionBinding, "generated">
  >({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" })
  const intakeQuestionRef = React.useRef<HTMLDivElement>(null)
  const intakeMotion = useOrderedStepMotion(step, INTAKE_MOTION_ORDER)
  const viewKey = recordsOpen
    ? "records"
    : notationReaderOpen
    ? "notation-reader"
    : stored !== null
    ? "active"
    : racePreview !== null
      ? "race-preview"
    : blocked
      ? "blocked"
      : generated !== null && gate !== null
        ? "candidates"
        : instantEntryOpen ? "instant-entry" : `intake-${step}`

  React.useLayoutEffect(() => {
    if (viewKey.startsWith("intake-")) return
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    if (scrollRegion !== null) scrollRegion.scrollTop = 0
  }, [viewKey])
  useActiveContentScroll(
    viewKey.startsWith("intake-") ? viewKey : null,
    intakeQuestionRef,
    undefined,
    true,
  )

  React.useEffect(() => {
    if (stored !== null || !planCloudBackupEnabled()) {
      setCloudRestorePending(false)
      if (!planCloudBackupEnabled()) setCloudPersistence("DEVICE_ONLY")
      return
    }
    let cancelled = false
    void loadLatestPlanFromServer().then((result) => {
      if (cancelled) return
      if (result.kind === "loaded" && savePlanBetaState(result.state).ok) {
        setStored(result.state)
        setCloudPersistence("SAVED")
      } else if (result.kind === "failed") {
        setCloudPersistence("FAILED")
      } else {
        setCloudPersistence("DEVICE_ONLY")
      }
      setCloudRestorePending(false)
    })
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (stored !== null && planCloudBackupEnabled()) {
      const attempt = ++cloudBackupAttempt.current
      setCloudPersistence("SAVING")
      void backupActivePlanToServer(stored).then((result) => {
        if (attempt !== cloudBackupAttempt.current) return
        setCloudPersistence(result.kind === "saved" ? "SAVED" : "FAILED")
      })
    } else if (!planCloudBackupEnabled()) {
      setCloudPersistence("DEVICE_ONLY")
    }
  }, [stored])

  const retryCloudBackup = () => {
    if (stored === null || !planCloudBackupEnabled()) return
    const attempt = ++cloudBackupAttempt.current
    setCloudPersistence("SAVING")
    void backupActivePlanToServer(stored).then((result) => {
      if (attempt !== cloudBackupAttempt.current) return
      setCloudPersistence(result.kind === "saved" ? "SAVED" : "FAILED")
    })
  }

  const generateCandidates = (
    nextDraft: Partial<PlanBetaIntake>,
    recordId: string | null = null,
    raceDate?: string,
    sessionTarget: PlanSessionTarget | null = detailedSessionTarget,
    candidateTargets: CandidateSessionTargets = candidateSessionTargets,
  ) => {
    draftRevision.current += 1
    setRetrySelection(null)
    if (currentCheck === null) {
      setErrorCode(null)
      setStep("safety")
      return
    }
    const completed = withQuickDefaults(nextDraft)
    const result = generatePlanFromDraft(
      raceDate === undefined ? completed : { ...completed, targetRaceDate: raceDate },
      currentCheck,
      recordId === null ? undefined : { selectedRecordId: recordId },
      sessionTarget ?? undefined,
      candidateTargets,
    )
    switch (result.kind) {
      case "blocked":
        setErrorCode(null)
        setCurrentCheck(null)
        setBlocked(true)
        return
      case "rejected":
        setErrorCode(result.code)
        return
      case "generated":
        setRacePreview(null)
        setErrorCode(null)
        setGate(result.gate)
        setGenerated(result.generated)
        setGeneratedIntake(result.intake)
        setGeneratedEvidence(result.athleteEvidence)
        setPrescriptionBinding(result.prescriptionBinding)
        return
      case "preview_only":
        setErrorCode(null)
        setGenerated(null)
        setGate(null)
        setRacePreview(result)
        return
    }
  }

  /**
   * 다듬기에서 항목 하나를 고른 뒤: 초안을 갱신하고 계획을 다시 만들어 결과로 돌아간다.
   * 안전 확인은 `generateCandidates` 안에서 다시 적용된다(현재 확인 값이 없으면 안전 질문으로).
   */
  const continueAfterRefinement = (nextDraft: Partial<PlanBetaIntake>) => {
    const completed = withQuickDefaults(nextDraft)
    setDraft(completed)
    setRefining(false)
    setSelectedRecordId(null)
    setComparisonRecordId(null)
    setRecordConfirmationPending(false)
    generateCandidates(completed, null, targetRaceDate || undefined)
  }

  /** 결과 화면에서 "다듬기" 항목을 탭하면 해당 질문 하나만 연다. */
  const openRefinement = (target: IntakeStep) => {
    if (!REFINE_STEPS.includes(target)) return
    draftRevision.current += 1
    setRetrySelection(null)
    setGenerated(null)
    setGate(null)
    setErrorCode(null)
    setRefining(true)
    setStep(target)
  }

  const selectRecord = (recordId: string) => {
    if (recordId === selectedRecordId) return
    setSelectedRecordId(recordId)
    setComparisonRecordId(null)
    setRecordConfirmationPending(true)
    if (generatedIntake !== null) generateCandidates(generatedIntake)
  }

  const changeMethod = (reference: PlanBetaIntake["selectedDetailedTemplateRef"]) => {
    if (generatedIntake === null) return
    const change = resolvePlanMethodChange(generatedIntake, reference)
    if (change.kind === "unchanged") return
    draftRevision.current += 1
    setRetrySelection(null)
    if (change.kind === "rejected") {
      setGenerated(null)
      setGate(null)
      setErrorCode(change.code)
      setStep("template")
      return
    }
    setDraft(change.intake)
    setComparisonRecordId(null)
    setRecordConfirmationPending(reference !== null && selectedRecordId !== null)
    // A previously confirmed record is never silently rebound to another method.
    generateCandidates(change.intake)
  }

  const persistCandidate = async (
    selection: CandidateSelection,
    activeGenerated: PlanGenerationSuccess,
  ) => {
    if (recordConfirmationPending
        || (generatedIntake?.selectedDetailedTemplateRef != null && prescriptionBinding.kind !== "bound")) return
    const revision = draftRevision.current
    const safety = currentCheck === null ? null : evaluatePlanSafety(currentCheck)
    if (safety === null || safety.kind === "blocked") {
      setGenerated(null)
      setGate(null)
      setCurrentCheck(null)
      setErrorCode(null)
      setRetrySelection(null)
      setBlocked(true)
      return
    }
    if (generatedEvidence === null) {
      setErrorCode("MINIMUM_PROFILE_INCOMPLETE")
      return
    }
    const result = await saveSelectedPlanCandidate(
      selection,
      activeGenerated,
      safety.gate,
      generatedIntake,
      generatedEvidence,
      () => draftRevision.current === revision,
    )
    if (draftRevision.current !== revision) return
    switch (result.kind) {
      case "saved":
        setErrorCode(null)
        setRetrySelection(null)
        setCelebrateActivePlan(true)
        setStored(result.state)
        return
      case "rejected":
        if (result.code === "RECENT_JOURNAL_REQUIRES_REVIEW" || result.code === "CURRENT_CHECK_REQUIRES_REVIEW") {
          setGenerated(null)
          setGate(null)
          setCurrentCheck(null)
          setRetrySelection(null)
          setBlocked(true)
          return
        }
        if (result.code === "PACE_ANCHOR_RECONFIRMATION_REQUIRED") {
          setAthleteRecords(loadAthleteRecords())
          setSelectedRecordId(null)
          setComparisonRecordId(null)
          setRecordConfirmationPending(true)
          if (generatedIntake !== null) generateCandidates(generatedIntake)
        }
        setErrorCode(result.code)
        setRetrySelection(result.code === "PLAN_STORAGE_WRITE_FAILED" ? selection : null)
        return
    }
  }

  const saveCandidate = async (selection: CandidateSelection, activeGenerated: PlanGenerationSuccess) => {
    if (selectionWrite.current) return
    selectionWrite.current = true
    setSelectionSaving(true)
    try { await persistCandidate(selection, activeGenerated) }
    catch { setErrorCode("PLAN_STORAGE_WRITE_FAILED"); setRetrySelection(selection) }
    finally { selectionWrite.current = false; setSelectionSaving(false) }
  }

  if (recordsOpen) {
    return <React.Suspense fallback={<p role="status">경기 기록을 열고 있어요.</p>}>
      <AthleteRecords onBack={() => {
        setAthleteRecords(loadAthleteRecords())
        setSelectedRecordId(null)
        setComparisonRecordId(null)
        setRecordConfirmationPending(false)
        setRecordsOpen(false)
        setRecordReturnCount(count => count + 1)
        // Re-evaluate current safety and authority; never reuse the old bound numbers.
        if (generatedIntake !== null) generateCandidates(generatedIntake, null, targetRaceDate || undefined)
      }} />
    </React.Suspense>
  }

  if (notationReaderOpen) {
    return <NotationReader onBack={() => setNotationReaderOpen(false)} />
  }

  if (cloudRestorePending && stored === null) {
    return <p role="status" style={{ padding: 24 }}>계정에 저장된 훈련 계획을 확인하고 있어요.</p>
  }

  if (stored !== null) {
    return (
      <PlanActiveState
        state={stored}
        cloudPersistence={cloudPersistence}
        onRetryCloudBackup={retryCloudBackup}
        celebrateOnMount={celebrateActivePlan}
        onStateChange={setStored}
        onArchived={(intake) => {
          draftRevision.current += 1
          setDetailedSessionTarget(null)
          setCandidateSessionTargets({})
          setSelectedRecordId(null)
          setComparisonRecordId(null)
          setRecordConfirmationPending(false)
          setRetrySelection(null)
          setCelebrateActivePlan(false)
          setStored(null)
          setDraft(intake)
          setGenerated(null)
          setGate(null)
          setBlocked(false)
          setCurrentCheck(null)
          setRefining(false)
          setStep("safety")
        }}
        onWritePlannedSessionLog={onWritePlannedSessionLog}
        returnToSession={returnToSession}
      />
    )
  }

  if (blocked) {
    return (
      <PlanBlockedGuide
        draft={draft}
        onWriteLog={() => onWriteLog?.("evening")}
        onRecheck={() => {
          setBlocked(false)
          setRefining(false)
          setStep("safety")
        }}
      />
    )
  }

  if (racePreview !== null) {
    return (
      <RaceDatePreview
        result={racePreview}
        onChangeDate={() => {
          setRacePreview(null)
          setStep("race-date")
        }}
        onContinueWithoutDate={() => {
          setTargetRaceDate("")
          setRacePreview(null)
          generateCandidates(draft)
        }}
      />
    )
  }

  if (adjustingMultiV3 !== null) return <MultiAdjustedPlanEditFlowV3 {...adjustingMultiV3.entry}
    isCurrentDraft={() => draftRevision.current === adjustingMultiV3.revision}
    onCancel={() => setAdjustingMultiV3(null)} onSaved={() => { setAdjustingMultiV3(null); onAdjustedStored() }} />
  if (adjustingV3 !== null) return <AdjustedPlanEditFlowV3 {...adjustingV3.entry}
    isCurrentDraft={() => draftRevision.current === adjustingV3.revision}
    onCancel={() => setAdjustingV3(null)} onSaved={() => { setAdjustingV3(null); onAdjustedStored() }} />
  if (adjusting !== null) return <AdjustedPlanEditFlow {...adjusting.entry}
    isCurrentDraft={() => draftRevision.current === adjusting.revision}
    onCancel={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); onAdjustedStored() }} />

  if (generated !== null && gate !== null && generatedIntake !== null && generatedEvidence !== null) {
    const adjustmentActions: Record<string, () => void> = {}
    if ((adjustmentResolver !== undefined || adjustmentResolverV3 !== undefined || multiAdjustmentResolverV3 !== undefined) && currentCheck !== null && !recordConfirmationPending) {
      for (const candidate of generated.candidates) {
        try {
        const context = { generated, gate, intake: generatedIntake, athleteEvidence: generatedEvidence,
          currentCheck, candidateId: candidate.candidateId, startDate: candidateStartDate }
        const multiEntry = matchingMultiAdjustmentEntryV3(multiAdjustmentResolverV3, context)
        if (multiEntry) {
          adjustmentActions[candidate.candidateId] = () => setAdjustingMultiV3({ entry: multiEntry, revision: draftRevision.current })
          continue
        }
        const entryV3 = matchingAdjustmentEntryV3(adjustmentResolverV3, context)
        if (entryV3) {
          adjustmentActions[candidate.candidateId] = () => setAdjustingV3({ entry: entryV3, revision: draftRevision.current })
          continue
        }
        const entry = matchingAdjustmentEntry(adjustmentResolver, context)
        if (entry === null) continue
        adjustmentActions[candidate.candidateId] = () => setAdjusting({ entry, revision: draftRevision.current })
        } catch {
          // A broken review provider must not remove the original candidates.
          continue
        }
      }
    }
    return (
      <>
        <PlanCandidates
          generated={generated}
          adjustmentActions={adjustmentActions}
          intake={generatedIntake}
          athleteEvidence={generatedEvidence}
          athleteRecords={athleteRecords}
          selectedRecordId={selectedRecordId}
          comparisonRecordId={comparisonRecordId}
          prescriptionBinding={prescriptionBinding}
          instantEntry={instantEntry}
          saving={selectionSaving}
          saveError={errorCode === null ? null : planErrorMessage(errorCode)}
          saveCode={errorCode}
          onRetrySave={retrySelection === null ? undefined : () => { void saveCandidate(retrySelection, generated) }}
          recordConfirmationPending={recordConfirmationPending}
          startDateValue={candidateStartDate}
          onStartDateChange={setCandidateStartDate}
          recordReturnCount={recordReturnCount}
          targetRaceDate={targetRaceDate}
          onManageRecords={() => {
            draftRevision.current += 1
            setRetrySelection(null)
            setRecordsOpen(true)
          }}
          onSelectRecord={selectRecord}
          onCompareRecord={setComparisonRecordId}
          onChangeMethod={changeMethod}
          detailedSessionTarget={detailedSessionTarget}
          candidateSessionTargets={candidateSessionTargets}
          onChangeCandidateSessionTarget={(kind, target) => {
            const targets = { ...candidateSessionTargets, [kind]: target }
            setCandidateSessionTargets(targets)
            setRecordConfirmationPending(selectedRecordId !== null)
            generateCandidates(generatedIntake, null, undefined, detailedSessionTarget, targets)
          }}
          onChangeSessionTarget={(target) => {
            if (samePlanSessionTarget(detailedSessionTarget, target) && Object.keys(candidateSessionTargets).length === 0) return
            setCandidateSessionTargets({})
            setDetailedSessionTarget(target)
            setRecordConfirmationPending(selectedRecordId !== null)
            generateCandidates(generatedIntake, null, undefined, target, {})
          }}
          onSelectionDetailsChange={() => {
            draftRevision.current += 1
            setRetrySelection(null)
          }}
          onConfirmRecord={() => {
            if (selectedRecordId !== null) {
              setRecordConfirmationPending(false)
              generateCandidates(generatedIntake, selectedRecordId)
            }
          }}
          onBack={() => {
            draftRevision.current += 1
            setGenerated(null)
            setGate(null)
            setErrorCode(null)
            setRetrySelection(null)
            setSelectedRecordId(null)
            setDetailedSessionTarget(null)
            setCandidateSessionTargets({})
            setComparisonRecordId(null)
            setRecordConfirmationPending(false)
            setRefining(false)
            setStep("safety")
          }}
          onRefine={openRefinement}
          onSelect={(selection) => {
            void saveCandidate(selection, generated)
          }}
        />
      </>
    )
  }

  if (instantEntryOpen) return <>
    <InstantPlanEntryForm today={todayISO()} initialEntry={instantEntry} onSubmit={value => {
      const prepared = prepareInstantPlanEntry(value)
      if (prepared.kind !== "ready") {
        setInstantEntryError(prepared.kind === "invalid" ? "입력한 종목·기록·날짜를 다시 확인해 주세요."
          : "기록을 저장하지 못했어요. 입력은 그대로 남아 있어요. 다시 시도해 주세요.")
        return
      }
      draftRevision.current += 1
      setInstantEntry(prepared.entry); setInstantEntryError(null); setInstantEntryOpen(false)
      setAthleteRecords(loadAthleteRecords()); setSelectedRecordId(prepared.recordId)
      setComparisonRecordId(null); setRecordConfirmationPending(false)
      const nextDraft: Partial<PlanBetaIntake> = { ...draft, eventDistanceM: prepared.entry.eventDistanceM,
        eventGroup: eventGroupForDistance(prepared.entry.eventDistanceM) }
      delete nextDraft.selectedDetailedTemplateRef
      if (draft.eventDistanceM !== prepared.entry.eventDistanceM) delete nextDraft.trainingFocus
      setDraft(nextDraft); setStep(firstUnansweredQuickStep(nextDraft)); setCurrentCheck(null)
    }} />
    {instantEntryError && <p role="alert">{instantEntryError}</p>}
    <details className="plan-detailed-options">
      <summary>기록 관리·훈련표 읽기</summary>
      <button type="button" className="plan-text-action" onClick={() => onManageRecords ? onManageRecords() : setRecordsOpen(true)}>내 경기 기록</button>
      <button type="button" className="plan-text-action" onClick={() => setNotationReaderOpen(true)}>훈련표 표기 읽기</button>
    </details>
  </>

  return (
    <>
      <PlanIntake
        key={step}
        step={step}
        motion={intakeMotion}
        questionRef={intakeQuestionRef}
        draft={draft}
        refining={refining}
        onBack={() => {
          if (refining) {
            setRefining(false)
            generateCandidates(draft, null, targetRaceDate || undefined)
            return
          }
          if (instantEntry !== undefined && (step === "experience" || step === "goal")) {
            setInstantEntryOpen(true)
            return
          }
          setStep(previousIntakeStep(step, draft.eventGroup))
        }}
        onJump={(target) => setStep(target)}
        onGoal={(eventDistanceM) => {
          const eventGroup = eventGroupForDistance(eventDistanceM)
          setSelectedRecordId(null)
          setComparisonRecordId(null)
          setRecordConfirmationPending(false)
          const nextDraft: Partial<PlanBetaIntake> = {
            ...draft,
            eventGroup,
            eventDistanceM,
            competitionDivision: draft.competitionDivision ?? QUICK_INTAKE_DEFAULTS.competitionDivision,
            // 종목이 바뀌면 상세 훈련표는 다시 고른다(다른 종목 표를 그대로 쓰지 않음).
            selectedDetailedTemplateRef: draft.eventDistanceM === eventDistanceM
              ? draft.selectedDetailedTemplateRef
              : QUICK_INTAKE_DEFAULTS.selectedDetailedTemplateRef,
          }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep(draft.experienceBand === undefined ? "experience" : firstUnansweredQuickStep(nextDraft))
        }}
        onDivision={(competitionDivision) => continueAfterRefinement({ ...draft, competitionDivision })}
        onExperience={(experienceBand) => {
          const nextDraft = { ...draft, experienceBand }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep(firstUnansweredQuickStep(nextDraft))
        }}
        onFocus={(trainingFocus) => continueAfterRefinement({
          ...draft,
          trainingFocus,
          selectedDetailedTemplateRef: null,
        })}
        onTemplate={(selectedDetailedTemplateRef) => continueAfterRefinement({
          ...draft,
          selectedDetailedTemplateRef,
        })}
        onDays={(availableDayCount) => {
          const nextDraft = { ...draft, availableDayCount }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep("safety")
        }}
        onFrameLength={(requestedFrameLength) => continueAfterRefinement({ ...draft, requestedFrameLength })}
        onTrainingTime={(trainingTimePreference: TrainingTimePreference) => continueAfterRefinement({ ...draft, trainingTimePreference })}
        onSecondSession={(secondSessionMode) => continueAfterRefinement({ ...draft, secondSessionMode })}
        targetRaceDate={targetRaceDate}
        onTargetRaceDateChange={setTargetRaceDate}
        onRaceDate={(raceDate) => {
          setRefining(false)
          if (raceDate === undefined) setTargetRaceDate("")
          generateCandidates(draft, null, raceDate)
        }}
        onManageRecords={() => onManageRecords?.()}
        onOpenNotationReader={() => setNotationReaderOpen(true)}
        onSafety={(nextCurrentCheck) => {
          const safety = evaluatePlanSafety(nextCurrentCheck)
          if (safety.kind === "blocked") {
            setErrorCode(null)
            setCurrentCheck(null)
            setBlocked(true)
            return
          }
          setErrorCode(null)
          setCurrentCheck(nextCurrentCheck)
          // 네 번째 답과 함께 바로 계획을 만든다. 나머지 항목은 기본값, 결과에서 다듬는다.
          const completed = prepareInstantIntake(draft, instantEntry)
          setDraft(completed)
          draftRevision.current += 1
          setRetrySelection(null)
          const result = generatePlanFromDraft(completed, nextCurrentCheck,
            instantEntry?.kind === "CURRENT_RECORD" && selectedRecordId !== null ? { selectedRecordId } : undefined)
          switch (result.kind) {
            case "blocked":
              setCurrentCheck(null)
              setBlocked(true)
              return
            case "rejected":
              setErrorCode(result.code)
              return
            case "generated":
              setRacePreview(null)
              setGate(result.gate)
              setGenerated(result.generated)
              setGeneratedIntake(result.intake)
              setGeneratedEvidence(result.athleteEvidence)
              setPrescriptionBinding(result.prescriptionBinding)
              setRecordConfirmationPending(result.prescriptionBinding.kind === "bound" && instantEntry?.kind === "CURRENT_RECORD")
              return
            case "preview_only":
              setGenerated(null)
              setGate(null)
              setRacePreview(result)
              return
          }
        }}
        onContinue={() => generateCandidates(draft, null, targetRaceDate || undefined)}
      />
      {errorCode !== null && (
        <div className="plan-inline-error" role="alert">
          {planErrorMessage(errorCode)}
        </div>
      )}
    </>
  )
}
