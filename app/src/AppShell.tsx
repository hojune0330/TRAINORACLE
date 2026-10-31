import React from "react"
import { arenaInvitation } from "./screens/treadmill/arena-types"
import { isPlainHomeEntry } from "./screens/home/HomeIntroduction"
import { acknowledgeAnnouncement, MINIGAME_ANNOUNCEMENT } from "./domain/product-announcements"
import { oracleV2FeatureEnabled } from "./domain/oracle-rollout"
import { productFeatures } from "./domain/product-features"
import { READER_HISTORY_KEY } from "./hooks/useReaderDialog"
import { useCalendarSnapshot } from "./hooks/useCalendarEntries"
import { accountJournalProjectionStatus } from "./domain/account/account-journal-projection"
import { rememberCalendarDate } from "./hooks/useCalendarPosition"
import { runDraftSafeNavigation } from "./domain/unsaved-draft-navigation"
import { useNavigationReturnFrame } from "./hooks/useNavigationReturnFrame"
import { BROWSER_BACK_LAYER_HISTORY_KEY, beginBrowserPopNavigation, consumeBrowserBackLayer, getBrowserNavigationEpoch, isBrowserPopScrollRestoration } from "./navigation/browserNavigation"
import { captureReaderPosition, captureCalendarReaderPosition, restoreReaderPosition, validJournalCalendarReturn,
  type JournalCalendarReturn, type ReaderPosition } from "./navigation/readerPosition"
import type { AppTab } from "./components/AppChrome"
import { AppShellFrame } from "./components/AppShellFrame"
import { DomainNavigationProvider, DomainNavigationScope } from "./components/DomainNavigation"
import type { DomainDockState, NavigationDomain } from "./components/DomainNavigation"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { clearRecoveryTab, readRecoveryTab } from "./domain/screen-recovery"
import type { ShellToastState } from "./components/AppShellFrame"
import { Home } from "./screens/Home"
import type { MoreView } from "./screens/More"
import { HomeOraclePreview } from "./screens/home/HomeOraclePreview"
import type { GuestOracleSession } from "./screens/OracleProfileV2"
import type { OracleProfileNavigationState } from "./screens/OracleProfileExperience"
import type { GameLoungeNavigationState } from "./screens/treadmill/GameLounge"
import { LogEntry } from "./screens/LogEntry"
import { DeferredMobileScreens } from "./DeferredMobileScreens"
import { accountFeatureEnabled } from "./domain/account/config"
import { loungeEntryIntent } from "./domain/lounge/entry-intent"
import { loadEntries, localOnlyCount, todayISO } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { awardJournalEntry, type EngagementAwardResult } from "./domain/engagement"
import { ACCOUNT_REWARD_EVENT, accountRewardsEnabled, accountRewardStatus, readAccountRewardSummary, hydrateAccountRewards } from "./domain/account/account-reward-service"
import { createSavedFactReceipt } from "./domain/save-receipt"
import { homeMemoReceiptStorageStatus, resolveHomeMemoReceipt, type HomeMemoReceipt } from "./domain/home-memo-receipt"
import { analysisNavigationForReceipt, type AnalysisNavigation, type AnalysisSection } from "./domain/analysis-navigation"
import { buildOraclePersonalResult } from "./domain/oracle-personal-result"
import { loadPlanBetaState, readPlanBetaStateFromStorage } from "./domain/plan-beta-store"
import { usePlanEvidenceHistory } from "./hooks/usePlanEvidenceHistory"
import { PlanEvidenceHistoryNotice } from "./components/PlanEvidenceHistoryNotice"
import { useAthleteRecordsSnapshot } from "./hooks/useAthleteRecordsSnapshot"
import { recordOracleJournalParticipation } from "./domain/oracle-participation"
import { capturePetJournalScope, recordConfirmedPetJournalSave } from "./domain/pet-journal-progress"
import { trackProductEvent } from "./domain/account/product-analytics-service"
import { setAccountAuthState } from "./domain/account/account-auth-state"
import { startVerifiedAccountScope } from "./domain/account/verified-account-scope"
import type { PlannedSessionLink } from "./domain/planned-session-link"
import {
  onLocalJournalScopeChange,
  activeLocalAccount,
  localJournalScopeGeneration,
  setActiveLocalAccount,
} from "./domain/account/local-journal-ownership"
import {
  INITIAL_VIEW_STATE,
  shouldResetTabView,
  tabForChrome,
  viewForJournalDraft,
  viewForJournalReturn,
  viewForPlannedSessionDraft,
  viewForTab,
} from "./domain/app-shell-state"
import {
  screenMotion as resolveScreenMotion,
  tabMotion,
  type AppScreenDescriptor,
  type AppScreenMotion,
} from "./domain/screen-motion"
import { AppLoadingState } from "./components/AppLoadingState"
import { MultiPlanEvidenceContext } from "./components/MultiPlanEvidenceContext"
import { AppOverlayNavigationProvider } from "./components/AppOverlayNavigation"
import { isTermId, type TermId } from "./domain/glossary"
import { getOracleTopic, isOracleTopicId, type OracleTopicId } from "./domain/oracle-exploration"
import { isReadingStage, type ReadingStage } from "./domain/record-reading-oracle"
import { isRunningProfileStage, type RunningProfileStage } from "./domain/running-profile"
import { isPaceToolStage, type PaceToolRequest } from "./domain/pace-tools"
import { isEligiblePaceRecordCurrent } from "./domain/account/eligible-account-pace-records"
import type { ImportReviewSession } from "./screens/ImportActivities"
const ImportedRecords = React.lazy(() => import("./screens/ImportedRecords").then(module => ({ default: module.ImportedRecords })))
const JOURNAL_REWARD_MESSAGE = {
  AWARDED: "기록한 날 +4P가 반영됐어요.",
  ALREADY_AWARDED: "오늘의 다른 기록도 함께 모였어요. 이 날짜의 4P는 이미 반영돼 있어요.",
  INELIGIBLE: "기록은 저장됐어요. 포인트는 훈련·회복 항목을 남긴 날에만 쌓여요.",
  SAVE_FAILED: "기록은 저장됐지만 포인트는 이 기기에 반영하지 못했어요.",
  PENDING: "기록은 보관됐어요. 계정 포인트를 확인하고 있어요.",
} satisfies Record<EngagementAwardResult["kind"], string>

const TOAST_READABLE_MS = 4000
const TOAST_EXIT_MS = 150
const OVERLAY_HISTORY_KEY = "trainoracleOverlay"
const MORE_HISTORY_KEY = "trainoracleMore"
const ORACLE_PLAN_HISTORY_KEY = "trainoracleOraclePlan"
const ORACLE_LOG_HISTORY_KEY = "trainoracleOracleLog"
const ORACLE_INVITATION_RETURN_KEY = "trainoracle.oracle-v2.invitation-return"
const DOMAIN_HISTORY_KEY = "trainoracleDomain"

function oracleV2Enabled(): boolean {
  return oracleV2FeatureEnabled(import.meta.env)
}
function oracleInvitationFragment(): string | null {
  const values = new URLSearchParams(window.location.hash.slice(1)).getAll("oracle-compare-invite")
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/u.test(values[0]!) ? values[0]! : null
}
function clearOracleInvitationReturn(): void {
  try { window.sessionStorage.removeItem(ORACLE_INVITATION_RETURN_KEY) } catch { /* Fragment entry still works without storage. */ }
}
function initialOracleEntry(): { requested: boolean; invitation: string | null } {
  if (!oracleV2Enabled() || typeof window === "undefined") return { requested: false, invitation: null }
  let invitation = oracleInvitationFragment()
  const query = new URLSearchParams(window.location.search)
  // Only the existing account return path may resume this tab's pending invitation.
  if (!invitation && !new URLSearchParams(window.location.hash.slice(1)).has("oracle-compare-invite") && query.get("account") === "1") {
    try {
      const pending = window.sessionStorage.getItem(ORACLE_INVITATION_RETURN_KEY)
      if (pending && /^[A-Za-z0-9_-]{43}$/u.test(pending)) invitation = pending
    } catch { /* No persistent or query-string fallback for invitation codes. */ }
  }
  return { requested: invitation !== null || query.get("oracleV2") === "1", invitation }
}

type AppOverlay =
  | { readonly kind: "imported-records"; readonly date?: string; readonly entryId?: string }
  | { readonly kind: "pace"; readonly stage: import("./domain/pace-tools").PaceToolStage; readonly token: string; readonly depth: number; readonly scrollTop?: number }
  | { readonly kind: "running-profile"; readonly stage: RunningProfileStage; readonly initialView?: "result" | "library" }
  | { readonly kind: "record-reading"; readonly stage: ReadingStage }
  | { readonly kind: "term"; readonly term: TermId }
  | { readonly kind: "feedback" }
  | { readonly kind: "athlete-records"; readonly initialPurpose?: "PERSONAL_BEST" }
  | { readonly kind: "oracle"; readonly topic: OracleTopicId; readonly mode?: "example" | "personal"; readonly scrollTop?: number }

type OverlayHistoryMarker = AppOverlay & {
  readonly owner: string
  readonly version: 1
}

type ShellReturnPoint = {
  readonly view: ReturnType<typeof viewForTab>
  readonly utilityView: "more" | "guide" | "minji" | "content" | "rewards" | "minigame" | null
  readonly utilityOrigin: "home" | "more"
  readonly moreView: MoreView
  readonly athleteRecordsOpen: boolean
}

type RecordingOrigin = ShellReturnPoint & {
  readonly owner: string | null
  readonly analysis: AnalysisNavigation | undefined
  readonly overlay: AppOverlay | null
  readonly scroll: number
  readonly focusLabel: string | null
  readonly focusText: string | null
  readonly direct: boolean
  readonly screen: React.ReactNode
  readonly screenKey: string
  readonly token: string
}

type DomainVisit = {
  readonly domain: NavigationDomain
  readonly token: string
  readonly scope: number
  readonly direct: boolean
  historyOwner: string
  readonly origin: ShellReturnPoint & {
    readonly owner: string | null
    readonly position: ReaderPosition
    readonly analysis: AnalysisNavigation | undefined
    readonly overlay: AppOverlay | null
    readonly domainToken: string | null
    readonly historyOwner: string
  }
}

function overlayHistoryMarker(state: unknown, owner: string): AppOverlay | null {
  if (typeof state !== "object" || state === null) return null
  const marker = (state as Record<string, unknown>)[OVERLAY_HISTORY_KEY]
  if (typeof marker !== "object" || marker === null) return null
  const value = marker as Record<string, unknown>
  if (value.version !== 1 || value.owner !== owner) return null
  if (value.kind === "pace" && isPaceToolStage(value.stage) && typeof value.token === "string"
    && Number.isInteger(value.depth) && (value.depth as number) > 0 && (value.depth as number) <= 100) return {
    kind: "pace", stage: value.stage, token: value.token, depth: value.depth as number,
    ...(typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop) && value.scrollTop >= 0 ? { scrollTop: value.scrollTop } : {}),
  }
  if (value.kind === "feedback") return { kind: "feedback" }
  if (value.kind === "imported-records") return { kind: "imported-records",
    ...(typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value.date) && typeof value.entryId === "string" && value.entryId.length > 0 && value.entryId.length < 256
      ? { date: value.date, entryId: value.entryId } : {}) }
  if (value.kind === "athlete-records") return { kind: "athlete-records", ...(value.initialPurpose === "PERSONAL_BEST" ? { initialPurpose: "PERSONAL_BEST" } : {}) }
  if (value.kind === "record-reading" && isReadingStage(value.stage)) return { kind: "record-reading", stage: value.stage }
  if (value.kind === "running-profile" && isRunningProfileStage(value.stage)) return { kind: "running-profile", stage: value.stage,
    ...(value.initialView === "library" ? { initialView: "library" as const } : {}) }
  if (value.kind === "oracle" && isOracleTopicId(value.topic)) return {
    kind: "oracle", topic: value.topic,
    ...(value.mode === "example" || value.mode === "personal" ? { mode: value.mode } : {}),
    ...(typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop) && value.scrollTop >= 0 ? { scrollTop: value.scrollTop } : {}),
  }
  const term = typeof value.term === "string" ? value.term : null
  if (value.kind === "term" && isTermId(term)) return { kind: "term", term }
  return null
}

export type AppShellMultiPlanRuntime = Pick<React.ComponentProps<typeof DeferredMobileScreens.PlanBeta>,
  "multiAdjustmentResolverV3" | "readMultiAdjustedEvidenceV3">

export function AppShell({ multiPlanRuntime, systemStatus }: {
  readonly multiPlanRuntime?: AppShellMultiPlanRuntime
  readonly systemStatus?: React.ReactNode
} = {}) {
  const guestScopeGeneration = localJournalScopeGeneration()
  const calendarSnapshot = useCalendarSnapshot()
  const [oracleEntry, setOracleEntry] = React.useState(initialOracleEntry)
  const [oracleEntryRevision, refreshOracleEntry] = React.useReducer((revision: number) => revision + 1, 0)
  const [oracleAuthResolved, setOracleAuthResolved] = React.useState(() => !accountFeatureEnabled())
  const [accountScopeRevision, setAccountScopeRevision] = React.useState(0)
  const [, refreshAccountJournals] = React.useReducer((revision: number) => revision + 1, 0)
  const [v, setV] = React.useState(() => {
    if (arenaInvitation()) return INITIAL_VIEW_STATE
    const recoveryTab = readRecoveryTab()
    const accountEntry = accountFeatureEnabled() && typeof window !== "undefined"
      && (new URLSearchParams(window.location.search).get("account") === "1" || loungeEntryIntent().requested)
    if (recoveryTab && !accountEntry) return viewForTab(recoveryTab)
    if (!accountFeatureEnabled() || typeof window === "undefined") return INITIAL_VIEW_STATE
    return new URLSearchParams(window.location.search).get("account") === "1" || loungeEntryIntent().requested
      ? { ...INITIAL_VIEW_STATE, accountOpen: true }
      : INITIAL_VIEW_STATE
  })
  React.useEffect(() => { clearRecoveryTab() }, [])
  // A direct route or interrupted-task recovery must never become an introduction.
  const [allowHomeIntroduction] = React.useState(() => v.tab === "home" && !v.accountOpen
    && !oracleEntry.requested && readRecoveryTab() === null && isPlainHomeEntry(window.location))
  const [savedToast, setSavedToast] = React.useState<ShellToastState | null>(null)
  const [homeMemoReceipt, setHomeMemoReceipt] = React.useState<HomeMemoReceipt | null>(null)
  const [homeMemoNotice, setHomeMemoNotice] = React.useState<string | null>(null)
  const homeMemoReceiptRef = React.useRef(homeMemoReceipt)
  homeMemoReceiptRef.current = homeMemoReceipt
  const confirmedSaveEffects = React.useRef<{
    entryId: string; savedAt: string; scope: number; rewardMessage: string; rewardRetry?: boolean
  } | null>(null)
  const [analysisContext, setAnalysisContext] = React.useState<AnalysisNavigation | undefined>()
  const analysisReturnContext = React.useRef<AnalysisNavigation | undefined>()
  const [oracleHubSection, setOracleHubSection] = React.useState<"training" | "profile" | "library">("training")
  const [guestOracleSession, setGuestOracleSession] = React.useState<GuestOracleSession | null>(null)
  const [profileNavigationState, setProfileNavigationState] = React.useState<OracleProfileNavigationState>()
  const [gameNavigationState, setGameNavigationState] = React.useState<GameLoungeNavigationState>()
  const recordingOrigin = React.useRef<RecordingOrigin | null>(null)
  const domainVisit = React.useRef<DomainVisit | null>(null)
  const domainVisits = React.useRef(new Map<string, DomainVisit>())
  const pendingDomainExit = React.useRef<string | null>(null)
  const domainPopDecision = React.useRef<{ visit: DomainVisit; scope: number; epoch: number; compensating: boolean; sourceToken: string | null } | null>(null)
  const restoreDomainRef = React.useRef<(visit: DomainVisit) => void>(() => undefined)
  const resumeDomainRef = React.useRef<(visit: DomainVisit, state: unknown) => void>(() => undefined)
  const enterOracleRef = React.useRef<(next: Extract<AppOverlay, { kind: "running-profile" }>) => void>(() => undefined)
  const domainPositions = React.useRef(new Map<string, ReaderPosition>())
  const [publishedDock, setPublishedDock] = React.useState<{ token: symbol; state: DomainDockState } | null>(null)
  const publishDock = React.useCallback((token: symbol, state: DomainDockState | null) => {
    setPublishedDock(current => state ? { token, state } : current?.token === token ? null : current)
  }, [])
  const coachingDayOrigin = React.useRef<RecordingOrigin | null>(null)
  const trainingContentOrigin = React.useRef<RecordingOrigin | null>(null)
  const guideOrigin = React.useRef<RecordingOrigin | null>(null)
  const oracleInputRef = React.useRef<{ topic: OracleTopicId; owner: string | null; inputKind: "log" | "records" | "plan"; historyToken?: string; mode: "example" | "personal"; scrollTop: number; view: ReturnType<typeof viewForTab> } | null>(null)
  // Keep only this mounted shell's return route. Forward always rereads the saved plan.
  const oraclePlanForwardRef = React.useRef<{ intent: NonNullable<typeof oracleInputRef.current>; scope: number } | null>(null)
  const hasStoredOraclePlan = React.useCallback(() => {
    try { return "state" in readPlanBetaStateFromStorage(undefined, undefined, multiPlanRuntime?.readMultiAdjustedEvidenceV3) }
    catch { return false }
  }, [multiPlanRuntime?.readMultiAdjustedEvidenceV3])
  const pendingReward = React.useRef<{ ownerId: string | null; date: string } | null>(null)
  const calendarDraftReturn = React.useRef<{ token: string; owner: string | null; view: typeof v } | null>(null)
  const calendarOriginalReturn = React.useRef<{ token: string; owner: string | null; view: typeof v;
    calendarReturn: JournalCalendarReturn | null; position: ReaderPosition } | null>(null)
  const pendingJournalSection = React.useRef<{ section: "JOURNAL" | "BODY"; scope: number } | null>(null)
  const [calendarReaderReturn, setCalendarReaderReturn] = React.useState<JournalCalendarReturn | null>(null)
  const calendarSnapshotRef = React.useRef(calendarSnapshot)
  calendarSnapshotRef.current = calendarSnapshot
  const lastJournalView = React.useRef<{ owner: string | null; view: typeof v } | null>(null)
  React.useEffect(() => {
    if (v.tab === "journal") lastJournalView.current = { owner: activeLocalAccount(), view: { ...v, detailDate: null, detailEntryId: undefined } }
  }, [v])
  React.useEffect(() => onLocalJournalScopeChange(() => {
    lastJournalView.current = null; calendarOriginalReturn.current = null; setCalendarReaderReturn(null)
    setV(state => state.tab === "journal" ? { ...viewForTab("journal") } : state)
  }), [])
  const [athleteRecordsOpen, setAthleteRecordsOpen] = React.useState(false)
  const [homeDetailOrigin, setHomeDetailOrigin] = React.useState<"home" | "rewards">("home")
  const scrollRegionRef = React.useRef<HTMLElement>(null)
  const [utilityView, setUtilityView] = React.useState<"more" | "guide" | "minji" | "content" | "rewards" | "minigame" | null>(() => arenaInvitation() || new URLSearchParams(location.search).get("games") === "lounge" ? "minigame" : null)
  const [utilityOrigin, setUtilityOrigin] = React.useState<"home" | "more">(() => new URLSearchParams(location.search).get("games") === "lounge" ? "home" : "more")
  const [moreView, setMoreView] = React.useState<MoreView>("tools")
  const moreVisibleRef = React.useRef(false)
  moreVisibleRef.current = v.tab === "home" && utilityView === "more" && !v.accountOpen && !v.restoreOpen
  const [decorationInitialDate, setDecorationInitialDate] = React.useState<string | undefined>()
  const decorationReturn = React.useRef<{ owner: string | null; view: typeof v; utility: typeof utilityView; scroll: number; focusLabel: string | null; focusText: string | null } | null>(null)
  const [overlay, setOverlay] = React.useState<AppOverlay | null>(null)
  const overlayRef = React.useRef<AppOverlay | null>(null)
  const paceRequestRef = React.useRef<{ token: string; owner: string | null; request: PaceToolRequest; opener: HTMLElement | null; consumed: boolean } | null>(null)
  const overlayScrollTopRef = React.useRef(0)
  const overlayReturnPosition = React.useRef<ReaderPosition | null>(null)
  const moreReturnPosition = React.useRef<ReaderPosition | null>(null)
  const moreConnectionReturn = React.useRef<{ view: MoreView; position: ReaderPosition | null } | null>(null)
  const overlayHistoryOwnerRef = React.useRef(`shell-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const restoreReturnRef = React.useRef<ShellReturnPoint | null>(null)
  const importReturnRef = React.useRef<RecordingOrigin | null>(null)
  const importReviewSession = React.useRef<ImportReviewSession>({ scope: localJournalScopeGeneration(), review: null, position: null })
  const importedListPosition = React.useRef<ReaderPosition | null>(null)
  React.useEffect(() => onLocalJournalScopeChange(() => {
    importReviewSession.current.scope = localJournalScopeGeneration(); importReviewSession.current.review = null; importReviewSession.current.position = null
    importedListPosition.current = null
  }), [])
  const pendingScreenMotionRef = React.useRef<Exclude<AppScreenMotion, "initial" | "none"> | null>(null)
  const { schedule: scheduleReturnFrame, invalidate: invalidateReturnFrame } = useNavigationReturnFrame()
  const restoreCalendarOriginal = React.useCallback((origin: NonNullable<typeof calendarOriginalReturn.current>) => {
    calendarOriginalReturn.current = null
    if (origin.owner !== activeLocalAccount() || origin.position.scope !== localJournalScopeGeneration()) {
      setCalendarReaderReturn(null); setV(INITIAL_VIEW_STATE); return
    }
    const restored = validJournalCalendarReturn(origin.calendarReturn, calendarSnapshotRef.current.entries)
    setCalendarReaderReturn(restored)
    setV(origin.view)
    scheduleReturnFrame(() => {
      const region = scrollRegionRef.current
      if (restored && region) region.scrollTop = origin.position.scroll
      else restoreReaderPosition(region, origin.position)
    })
  }, [scheduleReturnFrame])
  React.useEffect(() => {
    const connection = moreConnectionReturn.current
    if (utilityView === "more" && connection && moreView === connection.view) {
      moreConnectionReturn.current = null
      if (moreView === "tools") moreReturnPosition.current = null
      scheduleReturnFrame(() => restoreReaderPosition(scrollRegionRef.current, connection.position))
      return
    }
    if (utilityView !== "more" || moreView !== "tools" || !moreReturnPosition.current) return
    const position = moreReturnPosition.current
    moreReturnPosition.current = null
    scheduleReturnFrame(() => restoreReaderPosition(scrollRegionRef.current, position))
  }, [utilityView, moreView, scheduleReturnFrame])
  const runViewTransition = React.useCallback((
    motion: Exclude<AppScreenMotion, "initial" | "none">,
    update: () => void,
    preserveMountedDrafts = recordingOrigin.current !== null,
  ) => {
    // The remounted app-flow-stage supplies the non-blocking CSS transition.
    // Native document snapshots block rapid follow-up taps on mobile.
    const expectedScope = localJournalScopeGeneration()
    const expectedNavigation = getBrowserNavigationEpoch()
    runDraftSafeNavigation(() => {
      domainPopDecision.current = null
      invalidateReturnFrame()
      pendingScreenMotionRef.current = motion
      setSavedToast(current => current?.reviewMessage === undefined ? null : current)
      update()
    }, preserveMountedDrafts, () => localJournalScopeGeneration() === expectedScope
      && getBrowserNavigationEpoch() === expectedNavigation)
  }, [invalidateReturnFrame])

  const applyOverlay = React.useCallback((next: AppOverlay | null) => {
    const pace = paceRequestRef.current
    if (next?.kind === "pace" && (!pace || pace.token !== next.token || pace.owner !== activeLocalAccount() || pace.consumed)) next = null
    const leavingPace = overlayRef.current?.kind === "pace" && next?.kind !== "pace"
    overlayRef.current = next
    setOverlay(next)
    scheduleReturnFrame(() => {
      const scrollRegion = scrollRegionRef.current
      if (scrollRegion === null) return
      scrollRegion.scrollTop = next === null ? overlayScrollTopRef.current : next.kind === "oracle" || next.kind === "pace" ? next.scrollTop ?? 0 : 0
      scrollRegion.scrollLeft = 0
      if (next === null) restoreReaderPosition(scrollRegion, overlayReturnPosition.current)
      if (next?.kind === "imported-records" && !next.entryId && importedListPosition.current) restoreReaderPosition(scrollRegion, importedListPosition.current)
      if (leavingPace && pace?.opener?.isConnected) pace.opener.focus({ preventScroll: true })
    })
  }, [scheduleReturnFrame])

  const openOverlay = React.useCallback((next: AppOverlay, replaceCurrent = false) => {
    if (next.kind === "running-profile" && oracleV2Enabled() && domainVisit.current?.domain !== "oracle") {
      enterOracleRef.current(next)
      return
    }
    if (overlayRef.current === null) {
      overlayScrollTopRef.current = scrollRegionRef.current?.scrollTop ?? 0
      overlayReturnPosition.current = captureReaderPosition(scrollRegionRef.current)
    }
    const marker: OverlayHistoryMarker = { ...next, owner: overlayHistoryOwnerRef.current, version: 1 }
    const currentState = typeof window.history.state === "object" && window.history.state !== null
      ? window.history.state as Record<string, unknown>
      : {}
    const addsTermHistory = overlayRef.current?.kind === "term"
      && next.kind === "term"
      && overlayRef.current.term !== next.term
    const addsOracleHistory = overlayRef.current?.kind === "oracle"
      && next.kind === "oracle" && overlayRef.current.topic !== next.topic
    const addsReadingHistory = overlayRef.current?.kind === "record-reading"
      && next.kind === "record-reading" && overlayRef.current.stage !== next.stage
    const addsImportedHistory = overlayRef.current?.kind === "imported-records"
      && (next.kind !== "imported-records" || overlayRef.current.entryId !== next.entryId)
    const addsPaceHistory = next.kind === "pace" && (overlayRef.current?.kind !== "pace" || overlayRef.current.stage !== next.stage)
    const resultStages = ["preferences", "records", "training", "changes"]
    const addsProfileHistory = overlayRef.current?.kind === "running-profile"
      && (next.kind !== "running-profile" || overlayRef.current.stage !== next.stage
        && !(resultStages.includes(overlayRef.current.stage) && resultStages.includes(next.stage)))
    const oracleSibling = next.kind === "running-profile" && next.stage === "overview" && oracleV2Enabled()
      && domainVisit.current?.domain === "oracle" && (overlayRef.current === null
        || overlayRef.current.kind === "running-profile" && overlayRef.current.stage === "overview")
    const method = replaceCurrent || oracleSibling ? "replaceState" : overlayRef.current === null || addsTermHistory || addsOracleHistory || addsReadingHistory || addsProfileHistory || addsPaceHistory || addsImportedHistory ? "pushState" : "replaceState"
    if ((addsOracleHistory && overlayRef.current?.kind === "oracle") || (addsPaceHistory && overlayRef.current !== null)) {
      window.history.replaceState({ ...currentState, [OVERLAY_HISTORY_KEY]: {
        ...overlayRef.current, owner: overlayHistoryOwnerRef.current, version: 1,
        scrollTop: scrollRegionRef.current?.scrollTop ?? 0,
      } }, "", window.location.href)
    }
    window.history[method]({ ...currentState, [OVERLAY_HISTORY_KEY]: marker }, "", window.location.href)
    applyOverlay(next)
  }, [applyOverlay])

  const closeOverlay = React.useCallback(() => {
    const marker = overlayHistoryMarker(window.history.state, overlayHistoryOwnerRef.current)
    if (marker !== null) {
      window.history.back()
      return
    }
    applyOverlay(null)
  }, [applyOverlay])

  React.useEffect(() => {
    if (!oracleV2Enabled()) { clearOracleInvitationReturn(); return }
    if (!oracleEntry.invitation) clearOracleInvitationReturn()
    const onHashChange = () => {
      // Auth callbacks may clear their own fragment while the pending entry is still resolving.
      if (!new URLSearchParams(window.location.hash.slice(1)).has("oracle-compare-invite")) return
      const invitation = oracleInvitationFragment()
      if (!invitation) { clearOracleInvitationReturn(); setOracleEntry({ requested: false, invitation: null }); return }
      setOracleEntry({ requested: true, invitation })
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  React.useEffect(() => {
    if (!oracleV2Enabled() || !oracleEntry.requested) return
    if (oracleEntry.invitation && accountFeatureEnabled()) {
      // Preserve only the validated invitation, never an OAuth hash, profile or consent.
      try { window.sessionStorage.setItem(ORACLE_INVITATION_RETURN_KEY, oracleEntry.invitation) } catch { /* In-page login can still resume. */ }
      if (!oracleAuthResolved) return
      if (!activeLocalAccount()) {
        runDraftSafeNavigation(() => { applyOverlay(null); setV({ ...INITIAL_VIEW_STATE, accountOpen: true }); setUtilityView(null) })
        return
      }
    }
    runDraftSafeNavigation(() => {
      if (oracleEntry.invitation) {
        const url = new URL(window.location.href), fragment = new URLSearchParams(url.hash.slice(1))
        fragment.set("oracle-compare-invite", oracleEntry.invitation)
        url.hash = fragment.toString()
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
      }
      setV(viewForTab("trends"))
      setUtilityView(null)
      refreshOracleEntry()
      openOverlay({ kind: "running-profile", stage: "overview" })
      setOracleEntry({ requested: false, invitation: null })
      clearOracleInvitationReturn()
    })
  }, [oracleEntry, oracleAuthResolved, accountScopeRevision, applyOverlay, openOverlay])

  React.useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      beginBrowserPopNavigation()
      invalidateReturnFrame()
      if (consumeBrowserBackLayer(event)) {
        if (pendingDomainExit.current && event.state?.[DOMAIN_HISTORY_KEY] === pendingDomainExit.current) {
          window.requestAnimationFrame(() => { if (pendingDomainExit.current) window.history.back() })
        }
        return
      }
      const pendingDecision = domainPopDecision.current
      if (pendingDecision?.compensating && (event.state?.[DOMAIN_HISTORY_KEY] ?? null) === pendingDecision.sourceToken) {
        pendingDecision.epoch = getBrowserNavigationEpoch()
        pendingDecision.compensating = false
        return
      }
      const recording = recordingOrigin.current
      if (recording && event.state?.recordingDraft !== recording.token) {
        const allowed = runDraftSafeNavigation(() => {
          recordingOrigin.current = null
          if (recording.owner === activeLocalAccount()) restoreRecordingOrigin(recording)
          else { setV(INITIAL_VIEW_STATE); setUtilityView(null) }
        }, true)
        if (!allowed) window.history.pushState({ ...window.history.state, recordingDraft: recording.token }, "", window.location.href)
        return
      }
      const calendarOrigin = calendarDraftReturn.current
      if (calendarOrigin && event.state?.calendarDraft !== calendarOrigin.token) {
        const allowed = runDraftSafeNavigation(() => {
          calendarDraftReturn.current = null
          setV(calendarOrigin.owner === activeLocalAccount() ? calendarOrigin.view : INITIAL_VIEW_STATE)
        })
        if (!allowed) window.history.pushState({ ...window.history.state, calendarDraft: calendarOrigin.token }, "", window.location.href)
        return
      }
      const originalOrigin = calendarOriginalReturn.current
      if (originalOrigin && event.state?.calendarOriginalPage !== originalOrigin.token) {
        const allowed = runDraftSafeNavigation(() => {
          restoreCalendarOriginal(originalOrigin)
          const destination = pendingJournalSection.current
          pendingJournalSection.current = null
          if (destination?.scope === localJournalScopeGeneration()) setV(current => ({ ...current, journalSection: destination.section }))
          if (destination?.scope === localJournalScopeGeneration()) {
            const position = domainPositions.current.get(`journal:${destination.section}`)
            scheduleReturnFrame(() => {
              if (position) restoreReaderPosition(scrollRegionRef.current, position)
              else if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0
            })
          }
        })
        if (!allowed) window.history.pushState({ ...window.history.state, calendarOriginalPage: originalOrigin.token }, "", window.location.href)
        return
      }
      const visit = domainVisit.current
      const arriving = domainVisits.current.get(event.state?.[DOMAIN_HISTORY_KEY] as string)
      if (arriving && arriving !== visit && arriving.scope === localJournalScopeGeneration()
        && (!visit || arriving.origin.domainToken === visit.token) && pendingDomainExit.current === null) {
        const decision = { visit: arriving, scope: localJournalScopeGeneration(), epoch: getBrowserNavigationEpoch(), compensating: false, sourceToken: visit?.token ?? null }
        domainPopDecision.current = decision
        const allowed = runDraftSafeNavigation(() => {
          domainPopDecision.current = null
          if (window.history.state?.[DOMAIN_HISTORY_KEY] === arriving.token) resumeDomainRef.current(arriving, event.state)
          else window.history.forward()
        }, false, () => domainPopDecision.current === decision && decision.scope === localJournalScopeGeneration()
          && decision.epoch === getBrowserNavigationEpoch())
        if (!allowed) { decision.compensating = true; window.history.back() }
        return
      }
      if (visit && event.state?.[DOMAIN_HISTORY_KEY] !== visit.token) {
        const decision = { visit, scope: localJournalScopeGeneration(), epoch: getBrowserNavigationEpoch(), compensating: false, sourceToken: visit.token }
        domainPopDecision.current = decision
        const allowed = runDraftSafeNavigation(() => {
          domainPopDecision.current = null
          if (window.history.state?.[DOMAIN_HISTORY_KEY] === visit.token) {
            pendingDomainExit.current = visit.token
            window.history.back()
          } else restoreDomainRef.current(visit)
        }, false, () => domainPopDecision.current === decision && domainVisit.current === visit
          && decision.scope === localJournalScopeGeneration() && decision.epoch === getBrowserNavigationEpoch())
        if (!allowed) { pendingDomainExit.current = null; decision.compensating = true; window.history.forward() }
        return
      }
      if (visit && pendingDomainExit.current === visit.token) { window.history.back(); return }
      const forward = oraclePlanForwardRef.current
      if (forward && event.state?.[ORACLE_PLAN_HISTORY_KEY] === forward.intent.historyToken) {
        const isCurrent = () => oraclePlanForwardRef.current === forward
          && forward.scope === localJournalScopeGeneration() && forward.intent.owner === activeLocalAccount()
          && window.history.state?.[ORACLE_PLAN_HISTORY_KEY] === forward.intent.historyToken
        if (isCurrent() && hasStoredOraclePlan()) {
          const allowed = runDraftSafeNavigation(() => {
            if (!hasStoredOraclePlan()) { oraclePlanForwardRef.current = null; return }
            oraclePlanForwardRef.current = null
            oracleInputRef.current = forward.intent
            applyOverlay(null)
            setUtilityView(null)
            setAthleteRecordsOpen(false)
            setV(viewForTab("plan"))
          }, false, isCurrent)
          if (!allowed && isCurrent()) window.history.back()
          return
        }
        oraclePlanForwardRef.current = null
      }
      // A closed journal child is not a resumable draft. Forward must consume
      // that expired entry and keep its parent result, without saving again or
      // replacing the parent's history. Account/domain ownership still applies.
      if (typeof event.state?.[ORACLE_LOG_HISTORY_KEY] === "string" && oracleInputRef.current === null
        && visit?.domain === "oracle" && visit.scope === localJournalScopeGeneration()
        && visit.origin.owner === activeLocalAccount() && event.state?.[DOMAIN_HISTORY_KEY] === visit.token) {
        window.history.back()
        return
      }
      const intent = oracleInputRef.current
      const leavingOraclePlan = intent?.inputKind === "plan" && intent.historyToken !== undefined
        && event.state?.[ORACLE_PLAN_HISTORY_KEY] !== intent.historyToken
      const leavingOracleLog = intent?.inputKind === "log" && intent.historyToken !== undefined
        && event.state?.[ORACLE_LOG_HISTORY_KEY] !== intent.historyToken
      if ((leavingOracleLog || leavingOraclePlan) && overlayRef.current === null && intent.owner === activeLocalAccount()) {
        const restored: AppOverlay = { kind: "oracle", topic: intent.topic, mode: intent.mode, scrollTop: intent.scrollTop }
        const allowed = runDraftSafeNavigation(() => {
          oraclePlanForwardRef.current = leavingOraclePlan && hasStoredOraclePlan()
            ? { intent, scope: localJournalScopeGeneration() } : null
          oracleInputRef.current = null
          setV(intent.view)
          window.history.replaceState({ ...window.history.state, [OVERLAY_HISTORY_KEY]: {
            ...restored, owner: overlayHistoryOwnerRef.current, version: 1,
          } }, "", window.location.href)
          applyOverlay(restored)
        })
        if (!allowed) {
          const { [OVERLAY_HISTORY_KEY]: _overlay, ...rest } = window.history.state ?? {}
          window.history.pushState({ ...rest, [leavingOraclePlan ? ORACLE_PLAN_HISTORY_KEY : ORACLE_LOG_HISTORY_KEY]: intent.historyToken }, "", window.location.href)
        }
        return
      }
      const next = overlayHistoryMarker(event.state, overlayHistoryOwnerRef.current)
      if (next !== null) {
        applyOverlay(next)
      } else if (overlayRef.current !== null) {
        if (overlayRef.current.kind === "running-profile") {
          const previous = overlayRef.current
          if (!runDraftSafeNavigation(() => applyOverlay(null))) window.history.pushState({ ...window.history.state,
            [OVERLAY_HISTORY_KEY]: { ...previous, owner: overlayHistoryOwnerRef.current, version: 1 } }, "", window.location.href)
        } else applyOverlay(null)
      } else if (moreVisibleRef.current) {
        const marker = event.state?.[MORE_HISTORY_KEY]
        const section = marker?.owner === overlayHistoryOwnerRef.current ? marker.view : "tools"
        if (["tools", "learning", "account", "backup", "about", "introduction", "connections"].includes(section)) setMoreView(section)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [applyOverlay, invalidateReturnFrame, hasStoredOraclePlan, restoreCalendarOriginal])

  React.useEffect(() => {
    if (v.tab === "log" || calendarDraftReturn.current === null) return
    if (window.history.state?.calendarDraft === calendarDraftReturn.current.token) {
      const { calendarDraft: _draft, ...rest } = window.history.state
      window.history.replaceState(rest, "", window.location.href)
    }
    calendarDraftReturn.current = null
  }, [v.tab])

  React.useEffect(() => {
    const refresh = () => {
      const pending = pendingReward.current
      if (!pending || !accountRewardsEnabled() || pending.ownerId !== activeLocalAccount()) return
      const summary = readAccountRewardSummary()
      if (!summary && accountRewardStatus() !== "FAILED") return
      const rewardMessage = !summary ? "기록은 보관됐어요. 포인트 확인만 다시 해 주세요."
        : summary.today === pending.date && summary.journalRecordedToday
          ? "오늘 기록 포인트가 계정에 반영돼 있어요."
          : "계정 기록을 확인했어요. 현재 추가 적립된 기록 포인트는 없어요."
      if (confirmedSaveEffects.current?.scope === localJournalScopeGeneration()) {
        confirmedSaveEffects.current = { ...confirmedSaveEffects.current, rewardMessage, rewardRetry: !summary }
      }
      setSavedToast(current => current?.rewardMessage === JOURNAL_REWARD_MESSAGE.PENDING || current?.rewardRetry
        ? { ...current, rewardMessage, rewardRetry: !summary, rewardLoading: false } : current)
      // A failed summary read is retryable; never resubmit the journal or award.
      if (summary) pendingReward.current = null
    }
    const scope = () => {
      domainVisit.current = null; domainVisits.current.clear(); pendingDomainExit.current = null; domainPopDecision.current = null; domainPositions.current.clear()
      setPublishedDock(null)
      if (recordingOrigin.current) { setV(INITIAL_VIEW_STATE); setUtilityView(null) }
      recordingOrigin.current = null
      coachingDayOrigin.current = null
      trainingContentOrigin.current = null
      guideOrigin.current = null
      overlayReturnPosition.current = null
      moreReturnPosition.current = null
      moreConnectionReturn.current = null
      importReturnRef.current = null
      setGuestOracleSession(null)
      setProfileNavigationState(undefined)
      setGameNavigationState(undefined)
      pendingJournalSection.current = null
      analysisReturnContext.current = undefined
      setOracleHubSection("training")
      pendingReward.current = null; confirmedSaveEffects.current = null; oracleInputRef.current = null; decorationReturn.current = null; setDecorationInitialDate(undefined); setSavedToast(null); setHomeMemoReceipt(null); setHomeMemoNotice(null); setAnalysisContext(undefined)
      oraclePlanForwardRef.current = null
      paceRequestRef.current = null
      if (overlayRef.current?.kind === "pace" || overlayRef.current?.kind === "imported-records") {
        overlayHistoryOwnerRef.current = `shell-${Date.now()}-${Math.random().toString(36).slice(2)}`
        applyOverlay(null)
      }
    }
    window.addEventListener(ACCOUNT_REWARD_EVENT, refresh)
    const unsubscribe = onLocalJournalScopeChange(scope)
    return () => { window.removeEventListener(ACCOUNT_REWARD_EVENT, refresh); unsubscribe() }
  }, [])

  React.useEffect(() => {
    if (!accountFeatureEnabled()) {
      setAccountAuthState("FAILED")
      setActiveLocalAccount(null)
      return
    }
    setAccountAuthState("RESOLVING")
    const refresh = () => setAccountScopeRevision((value) => value + 1)
    // Hydration refreshes readers without remounting a volatile account draft.
    window.addEventListener("trainoracle:account-journals-changed", refreshAccountJournals)
    const unsubscribeScope = onLocalJournalScopeChange(refresh)
    const unsubscribeAuth = startVerifiedAccountScope(status => {
      setOracleAuthResolved(status !== "LOADING")
    })
    return () => {
      window.removeEventListener("trainoracle:account-journals-changed", refreshAccountJournals)
      unsubscribeScope()
      unsubscribeAuth()
    }
  }, [])

  React.useEffect(() => {
    void trackProductEvent("APP_OPENED")
    const url = new URL(window.location.href)
    if (url.searchParams.get("account") === "1") {
      url.searchParams.delete("account")
      window.history.replaceState(window.history.state, "", url)
    }
  }, [])

  const goHome = () => {
    runViewTransition("pop", () => {
      forgetDomain()
      oracleInputRef.current = null
      oraclePlanForwardRef.current = null
      recordingOrigin.current = null
      coachingDayOrigin.current = null
      setAthleteRecordsOpen(false)
      setUtilityView(null)
      setHomeDetailOrigin("home")
      setV(INITIAL_VIEW_STATE)
    }, false)
  }
  // This render's ticket belongs to the form continuation before asynchronous
  // storage. An A -> B -> A switch must not credit a late callback to a new scope.
  const petJournalScope = capturePetJournalScope()
  const confirmSavedJournalEffects = (savedEntry: JournalEntry) => {
    void recordConfirmedPetJournalSave({ date: savedEntry.date, kind: savedEntry.kind }, petJournalScope)
    const prior = confirmedSaveEffects.current
    const scope = localJournalScopeGeneration()
    if (prior?.scope === scope && prior.entryId === savedEntry.id && prior.savedAt === savedEntry.savedAt) return prior
    recordOracleJournalParticipation(savedEntry)
    const reward = awardJournalEntry(savedEntry, todayISO())
    pendingReward.current = reward.kind === "PENDING" ? { ownerId: activeLocalAccount(), date: savedEntry.date } : null
    const confirmed = { entryId: savedEntry.id, savedAt: savedEntry.savedAt, scope,
      rewardMessage: JOURNAL_REWARD_MESSAGE[reward.kind], rewardRetry: false }
    confirmedSaveEffects.current = confirmed
    void trackProductEvent("JOURNAL_SAVED")
    return confirmed
  }
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string, detailDate?: string, storageMessage?: string, completionAlreadyShown = false) => {
    setHomeMemoReceipt(current => current?.scopeGeneration === localJournalScopeGeneration() && current.id === savedEntry.id
      ? { scopeGeneration: current.scopeGeneration, id: savedEntry.id, kind: savedEntry.kind, date: savedEntry.date, savedAt: savedEntry.savedAt,
        storage: storageMessage ?? current.storage, storageStatus: homeMemoReceiptStorageStatus(savedEntry),
        ...(reviewMessage ? { review: reviewMessage } : {}) } : current)
    const { rewardMessage, rewardRetry } = confirmSavedJournalEffects(savedEntry)
    const receipt = createSavedFactReceipt(savedEntry)
    runViewTransition("replace", () => {
      const origin = recordingOrigin.current
      if (isOraclePlanRecording(origin)) window.history.back()
      else {
        recordingOrigin.current = null
        if (origin && origin.owner === activeLocalAccount()) restoreRecordingOrigin(origin)
        else {
          setUtilityView(null)
          setV(detailDate === undefined ? INITIAL_VIEW_STATE : viewForJournalReturn(v))
        }
      }
      // All form onDone contracts return only after a confirmed device/account
      // save; pending and conflict results stay in the form recovery flow.
      setSavedToast({ count: localOnlyCount(), phase: "enter", receipt, reviewMessage, storageMessage,
        storageStatus: "CONFIRMED", savedJournal: { id: savedEntry.id, date: savedEntry.date, kind: savedEntry.kind }, rewardMessage, rewardRetry, completionAlreadyShown })
      const intent = oracleInputRef.current
      if (reviewMessage === undefined && intent?.inputKind === "log" && intent.owner === activeLocalAccount()) {
        if (intent.historyToken && window.history.state?.[ORACLE_LOG_HISTORY_KEY] === intent.historyToken) window.history.back()
        else {
          oracleInputRef.current = null
          setV(intent.view)
          openOverlay({ kind: "oracle", topic: intent.topic, mode: "personal" })
        }
      } else if (intent?.inputKind === "log") oracleInputRef.current = null
    })
  }

  const retrySavedReward = () => {
    const pending = pendingReward.current
    if (!pending || pending.ownerId !== activeLocalAccount() || !accountRewardsEnabled()
      || accountRewardStatus() === "LOADING") return
    const scope = localJournalScopeGeneration()
    setSavedToast(current => current?.rewardRetry ? { ...current, rewardLoading: true } : current)
    void hydrateAccountRewards().catch(() => {
      if (scope !== localJournalScopeGeneration() || pendingReward.current !== pending) return
      setSavedToast(current => current?.rewardRetry ? { ...current, rewardLoading: false } : current)
    })
  }

  React.useEffect(() => {
    if (savedToast === null) return
    if (savedToast.receipt.savedDate !== undefined && !savedToast.completionAlreadyShown) return
    // Quick completion owns a persistent result surface too. Keep its actual
    // storage/reward receipt alive while reading or editing that saved entry.
    if (savedToast.receipt.savedDate !== undefined && savedToast.completionAlreadyShown
      && v.tab === "log" && v.entryType === "quick-session") return
    if (savedToast.reviewMessage !== undefined) return
    if (savedToast.rewardRetry || savedToast.rewardLoading || savedToast.rewardMessage === JOURNAL_REWARD_MESSAGE.PENDING) return
    const delay = savedToast.phase === "enter" ? TOAST_READABLE_MS : TOAST_EXIT_MS
    const t = window.setTimeout(() => {
      setSavedToast(current => {
        if (current === null) return null
        return current.phase === "enter" ? { ...current, phase: "exit" } : null
      })
    }, delay)
    return () => window.clearTimeout(t)
  }, [savedToast, v.tab, v.entryType])
  React.useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current
    if (scrollRegion === null) return
    if (isBrowserPopScrollRestoration()) return
    scrollRegion.scrollTop = 0
    scrollRegion.scrollLeft = 0
  }, [
    v.tab,
    v.entryType,
    v.detailDate,
    v.archiveSelection?.selectedMonth,
    v.archiveSelection?.selectedWeekStart,
    v.journalDraft?.date,
    v.journalDraft?.initialEntry?.id,
    athleteRecordsOpen,
    utilityView,
  ])
  const goTab = (tab: AppTab, analysis?: AnalysisNavigation) => {
    if (tab === "log") { startRecording(); return }
    if (tab === "journal" || tab === "trends") {
      if (v.tab === tab && utilityView === null && overlayRef.current === null && v.detailDate === null) return
      runViewTransition(tabMotion(v.tab, tab), () => enterDomain(tab === "journal" ? "journal" : "oracle", undefined, analysis), false)
      return
    }
    if (!shouldResetTabView(v, tab, utilityView !== null || athleteRecordsOpen || overlayRef.current !== null)) return
    runViewTransition(tabMotion(v.tab, tab), () => {
      forgetDomain()
      dismissOracle()
      oracleInputRef.current = null
      recordingOrigin.current = null
      setAthleteRecordsOpen(false)
      setUtilityView(null)
      setAnalysisContext(undefined)
      analysisReturnContext.current = undefined
      calendarOriginalReturn.current = null
      setCalendarReaderReturn(null)
      coachingDayOrigin.current = null
      setV(viewForTab(tab))
      trainingContentOrigin.current = null
      guideOrigin.current = null
      moreReturnPosition.current = null
    }, false)
  }
  const goTrendsFromReceipt = () => {
    const context = savedToast ? analysisNavigationForReceipt(savedToast.receipt ?? { kind: "generic" }) : null
    runViewTransition(tabMotion(v.tab, "trends"), () => {
      recordingOrigin.current = null
      setSavedToast(null)
      enterDomain("oracle", undefined, context ?? undefined)
    }, false)
  }
  const openDecorationStudio = (date?: string) => runViewTransition("push", () => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    decorationReturn.current = { owner: activeLocalAccount(), view: v, utility: utilityView, scroll: scrollRegionRef.current?.scrollTop ?? 0, focusLabel: active?.getAttribute("aria-label") ?? null, focusText: active?.textContent?.trim() ?? null }
    setDecorationInitialDate(date)
    setUtilityOrigin(utilityView === "more" ? "more" : "home")
    setUtilityView("rewards")
    setV({ ...viewForTab("home"), detailDate: null })
    setSavedToast(null)
    recordingOrigin.current = null
  }, false)
  const openHomeMemo = (decorate: boolean) => {
    const receipt = homeMemoReceipt
    if (!receipt) return
    const scope = localJournalScopeGeneration()
    let target: Pick<JournalEntry, "id" | "date"> | null = null
    const isCurrent = () => {
      // Reject stale producers before resolving or publishing a notice in a new scope.
      if (scope !== localJournalScopeGeneration() || homeMemoReceiptRef.current !== receipt) return false
      if (decorate && receipt.review !== undefined) return false
      let resolved: ReturnType<typeof resolveHomeMemoReceipt>
      try { resolved = resolveHomeMemoReceipt(receipt) }
      catch { resolved = { status: "UNAVAILABLE" } }
      if (scope !== localJournalScopeGeneration() || homeMemoReceiptRef.current !== receipt) return false
      if (resolved.status !== "READY") {
        setHomeMemoNotice(resolved.status === "UNAVAILABLE" ? "기록을 확인하지 못했어요. 일지에서 보관 상태를 확인해 주세요." : "기록이 바뀌었어요. 일지에서 다시 확인해 주세요.")
        return false
      }
      target = { id: resolved.entry.id, date: resolved.entry.date }
      return true
    }
    // The target must be usable before asking about, or discarding, another draft.
    if (!isCurrent()) return
    runDraftSafeNavigation(() => {
      const entry = target
      if (!entry) return
      setHomeMemoNotice(null)
      if (decorate) openDecorationStudio(entry.date)
      else runViewTransition("push", () => {
        setHomeDetailOrigin("home")
        setV(current => ({ ...current, detailDate: entry.date, detailEntryId: entry.id }))
      })
    }, false, isCurrent)
  }
  const closeDecorationStudio = () => runViewTransition("pop", () => {
    const origin = decorationReturn.current
    decorationReturn.current = null; setDecorationInitialDate(undefined)
    if (!origin || origin.owner !== activeLocalAccount()) { setUtilityView(utilityOrigin === "home" ? null : "more"); return }
    setV(origin.view); setUtilityView(origin.utility)
    scheduleReturnFrame(() => {
      if (origin.owner !== activeLocalAccount()) return
      if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = origin.scroll
      if (origin.focusLabel) scrollRegionRef.current?.querySelector<HTMLElement>(`[aria-label=${JSON.stringify(origin.focusLabel)}]`)?.focus({ preventScroll: true })
      else if (origin.focusText) [...(scrollRegionRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(button => button.textContent?.trim() === origin.focusText)?.focus({ preventScroll: true })
    })
  })
  const dismissOracle = () => {
    overlayReturnPosition.current = null
    // Leaving the exploration invalidates its older history entries too.
    // Otherwise Back could reopen a sample over a different destination tab.
    overlayHistoryOwnerRef.current = `shell-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (domainVisit.current) domainVisit.current.historyOwner = overlayHistoryOwnerRef.current
    oraclePlanForwardRef.current = null
    paceRequestRef.current = null
    if (overlayRef.current?.kind !== "oracle" && overlayRef.current?.kind !== "record-reading" && overlayRef.current?.kind !== "running-profile" && overlayRef.current?.kind !== "pace") return
    const currentState = window.history.state
    if (typeof currentState === "object" && currentState !== null) {
      const { [OVERLAY_HISTORY_KEY]: _marker, ...rest } = currentState as Record<string, unknown>
      window.history.replaceState(rest, "", window.location.href)
    }
    overlayRef.current = null
    setOverlay(null)
    if (scrollRegionRef.current !== null) scrollRegionRef.current.scrollTop = 0
  }
  const openOracle = (topic: OracleTopicId, mode?: "example" | "personal") => runViewTransition("push", () => {
    const directTarget = domainVisit.current?.domain !== "oracle"
    if (directTarget) enterDomain("oracle")
    openOverlay({ kind: "oracle", topic, ...(mode ? { mode } : {}) }, directTarget)
  })
  const changeOracleMode = (mode: "example" | "personal") => {
    const current = overlayRef.current
    if (current?.kind !== "oracle") return
    const next = { ...current, mode, scrollTop: scrollRegionRef.current?.scrollTop ?? 0 }
    overlayRef.current = next
    setOverlay(next)
    window.history.replaceState({ ...window.history.state, [OVERLAY_HISTORY_KEY]: {
      ...next, owner: overlayHistoryOwnerRef.current, version: 1,
    } }, "", window.location.href)
  }
  const returnFromOracleInput = () => runViewTransition("pop", () => {
    const intent = oracleInputRef.current
    if (intent?.inputKind === "log" && intent.owner === activeLocalAccount()
      && intent.historyToken && window.history.state?.[ORACLE_LOG_HISTORY_KEY] === intent.historyToken) {
      window.history.back()
      return
    }
    oracleInputRef.current = null
    if (!intent || intent.owner !== activeLocalAccount()) { setV(INITIAL_VIEW_STATE); return }
    setV(intent.view)
    openOverlay({ kind: "oracle", topic: intent.topic, mode: intent.mode, scrollTop: intent.scrollTop })
  })
  const openOraclePersonal = (action: "records" | "journal" | "trends" | "plan" | "log", section?: AnalysisSection, metric?: "DISTANCE_KM" | "RPE") => {
    runViewTransition("push", () => {
      if (action === "journal") { enterDomain("journal"); return }
      oraclePlanForwardRef.current = null
      const topic = overlayRef.current?.kind === "oracle" ? overlayRef.current.topic : null
      oracleInputRef.current = topic && (action === "records" || action === "log" || action === "plan")
        ? { topic, owner: activeLocalAccount(), inputKind: action,
          ...(action === "plan" || action === "log" ? { historyToken: `oracle-${action}-${Date.now()}-${Math.random().toString(36).slice(2)}` } : {}),
          mode: overlayRef.current?.kind === "oracle" ? overlayRef.current.mode ?? "personal" : "personal", scrollTop: scrollRegionRef.current?.scrollTop ?? 0, view: v } : null
      if (action === "records") {
        dismissOracle()
        setUtilityView(null)
        setV(viewForTab("plan"))
        setAthleteRecordsOpen(true)
      } else {
        if ((action === "plan" || action === "log") && oracleInputRef.current?.historyToken) {
          // Preserve the result's domain entry beneath its child input. Plan
          // readers inherit their token; journal close/save consumes its child.
          const { [OVERLAY_HISTORY_KEY]: _overlay, ...rest } = window.history.state ?? {}
          window.history.pushState({ ...rest, [action === "plan" ? ORACLE_PLAN_HISTORY_KEY : ORACLE_LOG_HISTORY_KEY]: oracleInputRef.current.historyToken }, "", window.location.href)
          applyOverlay(null)
          // This opens a new input screen, rather than returning to the view
          // beneath the explanation. Do not restore its old scroll or focus.
          invalidateReturnFrame()
        } else dismissOracle()
        setAthleteRecordsOpen(false)
        setUtilityView(null)
        setAnalysisContext(action === "trends" ? { section: section ?? "summary", ...(metric === "DISTANCE_KM" ? { metric } : {}) } : undefined)
        setV(viewForTab(action, action === "log" ? "quick-session" : undefined))
      }
    })
  }
  const returnToOracleAfterRecord = () => runViewTransition("pop", () => {
    setAthleteRecordsOpen(false)
    const intent = oracleInputRef.current
    oracleInputRef.current = null
    if (intent && intent.owner === activeLocalAccount()) openOverlay({ kind: "oracle", topic: intent.topic, mode: "personal" })
  })
  const oracleUsesPlan = overlay?.kind === "oracle" && (overlay.topic === "focus" || overlay.topic === "priority")
  const oracleHistory = usePlanEvidenceHistory((oracleUsesPlan && overlay?.mode !== "example") || v.tab === "home")
  const athleteRecords = useAthleteRecordsSnapshot()
  const oracleReadScope = localJournalScopeGeneration()
  const oracleReadStatus = overlay?.kind === "oracle" && overlay.topic === "level"
    ? athleteRecords.status === "LOADING" ? "loading" : athleteRecords.status === "READY" ? "ready" : "unavailable"
    : calendarSnapshot.status === "LOADING"
      || calendarSnapshot.status === "STALE" && accountJournalProjectionStatus() === "LOADING" ? "loading"
      : calendarSnapshot.status === "READY" && oracleHistory.journalReadComplete ? "ready" : "unavailable"
  const oracleResult = overlay?.kind === "oracle" ? buildOraclePersonalResult({
    topicId: overlay.topic, entries: loadEntries(), planState: loadPlanBetaState(),
    athleteRecords: athleteRecords.records, today: todayISO(), planHistory: oracleHistory.history,
  }) : undefined
  const homePlanRead = v.tab === "home" ? (() => {
    // The compact home summary supports ordinary saved plans only. Keep the
    // supplied multi-plan evidence reader lazy until the actual plan view opens.
    try { return readPlanBetaStateFromStorage() }
    catch { return { kind: "storage_error" as const } }
  })() : null
  const homePlanState = homePlanRead?.kind === "loaded" ? homePlanRead.state : null
  const homePlanReadUnavailable = homePlanRead !== null && homePlanRead.kind !== "loaded" && homePlanRead.kind !== "missing"
  const homeCandidates = v.tab === "home" ? (["focus", "level", "mix"] as const).flatMap(topic => {
    if (topic === "level" && athleteRecords.status !== "READY") return []
    if (topic !== "level" && (calendarSnapshot.status !== "READY" || !oracleHistory.journalReadComplete)) return []
    const result = buildOraclePersonalResult({ topicId: topic, entries: calendarSnapshot.entries,
      planState: homePlanState, athleteRecords: athleteRecords.records,
      today: todayISO(), planHistory: oracleHistory.history })
    return result.status !== "missing" && result.rows.length > 0 ? [{ topic, result }] : []
  }) : []
  const homeCandidate = homeCandidates[0]
  const homeSourceUnavailable = calendarSnapshot.status !== "READY" || athleteRecords.status !== "READY"
    || !oracleHistory.journalReadComplete || homePlanReadUnavailable
  const homeExample = getOracleTopic("focus")
  // A completion checklist is not an Oracle insight. Plans remain in Training.
  const homeOraclePreview = !homeCandidate && !homeSourceUnavailable && homePlanState !== null ? null : <HomeOraclePreview
    question={homeCandidate ? getOracleTopic(homeCandidate.topic).question : homeSourceUnavailable ? "내 기록을 확인할까요?" : homeExample.question}
    answer={homeCandidate?.result.headline ?? (homeSourceUnavailable ? homePlanReadUnavailable ? "저장한 훈련 계획을 확인하지 못했어요." : "기록 확인 후 오라클 결과를 볼 수 있어요." : homeExample.example.headline)}
    sourceLabel={homeCandidate ? `${homeCandidate.result.source}${homeCandidate.topic === "focus" ? ` · ${homeCandidate.result.rows[0]?.label.split(" · ")[0]}~${homeCandidate.result.rows.at(-1)?.label.split(" · ")[0]}` : ""} · 확인일 ${todayISO()}` : homeSourceUnavailable ? "확인되지 않은 자료는 결과에 넣지 않아요." : homeExample.example.source}
    kind={homeCandidate ? homeCandidate.result.status === "partial" ? "partial" : "personal" : homeSourceUnavailable ? "unavailable" : "example"}
    unavailableActionLabel={homePlanReadUnavailable ? "저장한 계획 확인"
      : athleteRecords.status !== "READY" ? "경기 기록 상태 확인" : "기록 상태 확인"}
    onOpen={() => homeCandidate ? homeCandidate.topic === "level" ? openOracle("level", "personal") : goTab("trends", { section: "summary", reportSource: "my", reportMonths: 3 })
      : homePlanReadUnavailable ? goTab("plan")
      : athleteRecords.status !== "READY" ? openOverlay({ kind: "athlete-records" })
      : homeSourceUnavailable ? goTab("trends") : goTab("trends", { section: "summary", reportSource: "example", reportMonths: 3 })}
  />

  const accountEnabled = accountFeatureEnabled()
  const screenKey = [
    v.tab,
    v.entryType,
    v.detailDate ?? "",
    v.importOpen ? "import" : "",
    v.restoreOpen ? "restore" : "",
    v.accountOpen ? "account" : "",
    utilityView ?? "",
    utilityView === "more" ? moreView : "",
    athleteRecordsOpen ? "records" : "",
  ].join(":")

  const screenDepth = v.detailDate !== null
    || v.accountOpen
    || v.restoreOpen
    || v.importOpen
    || athleteRecordsOpen
    || v.entryType !== "choose"
    ? 1
    : utilityView === null
      ? 0
      : utilityView === "more" || utilityOrigin === "home"
        ? 1
        : 2
  const currentScreen: AppScreenDescriptor = {
    key: screenKey,
    tab: v.tab,
    depth: screenDepth,
  }
  const previousScreenRef = React.useRef<AppScreenDescriptor | null>(null)
  const currentScreenMotion = previousScreenRef.current === null
    ? "initial"
    : pendingScreenMotionRef.current ?? resolveScreenMotion(previousScreenRef.current, currentScreen)
  React.useLayoutEffect(() => {
    previousScreenRef.current = currentScreen
    pendingScreenMotionRef.current = null
  }, [screenKey, v.tab, screenDepth])

  const captureReturnPoint = (): ShellReturnPoint => ({
    view: v,
    utilityView,
    utilityOrigin,
    moreView,
    athleteRecordsOpen,
  })
  const captureRecordingOrigin = (direct: boolean): RecordingOrigin => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return { ...captureReturnPoint(), owner: activeLocalAccount(), analysis: analysisReturnContext.current ?? analysisContext,
      overlay: overlayRef.current, scroll: scrollRegionRef.current?.scrollTop ?? 0,
      focusLabel: active?.getAttribute("aria-label") ?? null, focusText: active?.textContent?.trim() ?? null, direct,
      screen, screenKey, token: `record-${Date.now()}-${Math.random().toString(36).slice(2)}` }
  }
  const restoreRecordingOrigin = (origin: RecordingOrigin, restoreOverlayHistory = true) => {
    if (window.history.state?.recordingDraft === origin.token) {
      const { recordingDraft: _recordingDraft, ...state } = window.history.state
      window.history.replaceState(state, "", window.location.href)
    }
    restoreReturnPoint(origin)
    setAnalysisContext(origin.analysis)
    analysisReturnContext.current = origin.analysis
    if (origin.overlay) {
      if (restoreOverlayHistory) openOverlay(origin.overlay)
      else applyOverlay(origin.overlay)
    }
    scheduleReturnFrame(() => {
      if (origin.owner !== activeLocalAccount()) return
      if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = origin.scroll
      const buttons = [
        ...(scrollRegionRef.current?.querySelectorAll<HTMLElement>("button, a") ?? []),
        ...document.querySelectorAll<HTMLElement>(".app-tab-bar button, .app-tab-bar a"),
      ]
      const target = origin.focusLabel ? buttons.find(button => button.getAttribute("aria-label") === origin.focusLabel)
        : buttons.find(button => button.textContent?.trim() === origin.focusText)
      target?.focus({ preventScroll: true })
    })
  }
  function captureDomainOrigin(domainToken: string | null, recording?: RecordingOrigin): DomainVisit["origin"] {
    const point: ShellReturnPoint = recording ? { view: recording.view, utilityView: recording.utilityView,
      utilityOrigin: recording.utilityOrigin, moreView: recording.moreView, athleteRecordsOpen: recording.athleteRecordsOpen } : captureReturnPoint()
    const { journalDraft: _draft, bodyInputPartId: _bodyInput, ...view } = point.view
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return { ...point, view, owner: activeLocalAccount(),
      position: recording ? { scope: localJournalScopeGeneration(), scroll: recording.scroll, focusId: null, focusDate: null,
        focusLabel: recording.focusLabel, focusText: recording.focusText } : { ...captureReaderPosition(scrollRegionRef.current),
        focusLabel: active?.getAttribute("aria-label") ?? null, focusText: active?.matches("button, a, select") ? active.textContent?.trim() ?? null : null },
      analysis: recording ? recording.analysis : analysisReturnContext.current ?? analysisContext, overlay: recording ? recording.overlay : overlayRef.current,
      domainToken, historyOwner: overlayHistoryOwnerRef.current }
  }
  function forgetDomain() {
    domainVisit.current = null
    domainVisits.current.clear()
    pendingDomainExit.current = null
    const { [DOMAIN_HISTORY_KEY]: _domain, ...state } = window.history.state ?? {}
    window.history.replaceState(state, "", window.location.href)
  }
  function enterDomain(domain: NavigationDomain, target?: Extract<AppOverlay, { kind: "running-profile" }>, analysis?: AnalysisNavigation, originOverride?: DomainVisit["origin"]) {
    if (domainVisit.current?.domain !== domain) {
      const origin = originOverride ?? captureDomainOrigin(typeof window.history.state?.[DOMAIN_HISTORY_KEY] === "string" ? window.history.state[DOMAIN_HISTORY_KEY] as string : null)
      const token = `domain-${Date.now()}-${Math.random().toString(36).slice(2)}`
      domainVisit.current = { domain, token, scope: localJournalScopeGeneration(), direct: domain === "oracle" && oracleEntry.requested, historyOwner: overlayHistoryOwnerRef.current, origin }
      domainVisits.current.set(token, domainVisit.current)
      const { [OVERLAY_HISTORY_KEY]: _overlay, ...state } = window.history.state ?? {}
      window.history.pushState({ ...state, [DOMAIN_HISTORY_KEY]: token }, "", window.location.href)
    }
    dismissOracle()
    recordingOrigin.current = null
    setAthleteRecordsOpen(false)
    setCalendarReaderReturn(null)
    setUtilityView(domain === "games" ? "minigame" : null)
    if (domain === "journal") {
      const remembered = lastJournalView.current?.owner === activeLocalAccount() ? lastJournalView.current.view : viewForTab("journal")
      setV({ ...remembered, journalSection: "JOURNAL", detailDate: null, detailEntryId: undefined })
    } else if (domain === "oracle") {
      setV(viewForTab("trends"))
      setAnalysisContext(analysis)
      analysisReturnContext.current = analysis
      const section = target ? target.initialView === "library" ? "library" : "profile" : "training"
      setOracleHubSection(section)
      if (target) openOverlay(target)
    } else {
      acknowledgeAnnouncement(MINIGAME_ANNOUNCEMENT)
      setV(viewForTab("home"))
    }
    const position = domainPositions.current.get(`${domain}:${domain === "journal" ? "JOURNAL" : domain === "games" ? "games" : "training"}`)
      ?? (domain === "games" ? gameNavigationState?.positions?.games : undefined)
    if (!target && position) scheduleReturnFrame(() => restoreReaderPosition(scrollRegionRef.current, position))
  }
  enterOracleRef.current = next => runViewTransition("push", () => enterDomain("oracle", next), false)
  restoreDomainRef.current = visit => {
    if (visit.scope !== localJournalScopeGeneration() || visit.origin.owner !== activeLocalAccount()) {
      domainVisit.current = null; overlayRef.current = null; setOverlay(null); restoreReturnPoint(null); return
    }
    domainPositions.current.set(`${visit.domain}:${visit.domain === "oracle" ? oracleHubSection : visit.domain === "journal" ? v.journalSection ?? "JOURNAL" : publishedDock?.state.current ?? "games"}`, captureReaderPosition(scrollRegionRef.current))
    if (visit.domain === "journal") coachingDayOrigin.current = null
    pendingDomainExit.current = null
    domainVisit.current = visit.origin.domainToken ? domainVisits.current.get(visit.origin.domainToken) ?? null : null
    overlayRef.current = null; setOverlay(null)
    overlayHistoryOwnerRef.current = visit.origin.historyOwner
    restoreReturnPoint(visit.origin)
    setAnalysisContext(visit.origin.analysis)
    analysisReturnContext.current = visit.origin.analysis
    if (visit.origin.overlay) applyOverlay(visit.origin.overlay)
    setOracleHubSection(visit.origin.overlay?.kind === "running-profile" ? visit.origin.overlay.initialView === "library" ? "library" : "profile" : "training")
    scheduleReturnFrame(() => {
      restoreReaderPosition(scrollRegionRef.current, visit.origin.position)
      const position = visit.origin.position
      const buttons = [...document.querySelectorAll<HTMLElement>(".app-tab-bar button")]
      const target = position.focusLabel ? buttons.find(button => button.getAttribute("aria-label") === position.focusLabel)
        : buttons.find(button => button.textContent?.trim() === position.focusText)
      target?.focus({ preventScroll: true })
    })
  }
  const exitDomain = () => runViewTransition("pop", () => {
    const visit = domainVisit.current
    if (visit) domainPositions.current.set(`${visit.domain}:${visit.domain === "oracle" ? oracleHubSection : visit.domain === "journal" ? v.journalSection ?? "JOURNAL" : publishedDock?.state.current ?? "games"}`, captureReaderPosition(scrollRegionRef.current))
    if (!visit) { dismissOracle(); forgetDomain(); setUtilityView(null); setV(INITIAL_VIEW_STATE); return }
    if (window.history.state?.[DOMAIN_HISTORY_KEY] === visit.token) {
      pendingDomainExit.current = visit.token
      window.history.back()
    }
    else restoreDomainRef.current(visit)
  }, false)
  const switchOracleSection = (section: "training" | "profile" | "library") => {
    if (section === oracleHubSection && (section === "training" || overlayRef.current?.kind === "running-profile")) return
    if (!oracleV2Enabled() && section === "library") { openTrainingReading(); return }
    runViewTransition("replace", () => {
      domainPositions.current.set(`oracle:${oracleHubSection}`, captureReaderPosition(scrollRegionRef.current))
      setOracleHubSection(section)
      if (section === "training") {
        const { [OVERLAY_HISTORY_KEY]: _overlay, ...state } = window.history.state ?? {}
        window.history.replaceState(state, "", window.location.href)
        applyOverlay(null)
      } else openOverlay({ kind: "running-profile", stage: "overview", initialView: section === "library" ? "library" : "result" })
      const position = domainPositions.current.get(`oracle:${section}`)
      scheduleReturnFrame(() => {
        if (position) restoreReaderPosition(scrollRegionRef.current, position)
        else if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0
      })
    }, true)
  }
  const switchJournalSection = (section: "JOURNAL" | "BODY") => {
    if (v.detailDate === null && section === (v.journalSection ?? "JOURNAL")) return
    runViewTransition("replace", () => {
      if (v.detailDate !== null) coachingDayOrigin.current = null
      domainPositions.current.set(`journal:${v.journalSection ?? "JOURNAL"}`, captureReaderPosition(scrollRegionRef.current))
      const original = calendarOriginalReturn.current
      if (v.detailDate !== null && original && window.history.state?.calendarOriginalPage === original.token) {
        pendingJournalSection.current = { section, scope: localJournalScopeGeneration() }
        window.history.back()
        return
      }
      if (v.detailDate === null && publishedDock?.state.domain === "journal") publishedDock.state.onSelect(section)
      else setV(current => ({ ...current, tab: "journal", detailDate: null, detailEntryId: undefined, journalSection: section }))
      const position = domainPositions.current.get(`journal:${section}`)
      scheduleReturnFrame(() => {
        if (position) restoreReaderPosition(scrollRegionRef.current, position)
        else if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0
      })
    }, true)
  }
  resumeDomainRef.current = (visit, state) => {
    if (visit.scope !== localJournalScopeGeneration() || visit.origin.owner !== activeLocalAccount()) return
    // The parent entry may have replaced a sibling while this child was closed.
    // Forward's return belongs to that actual parent, not its older snapshot.
    visit = { ...visit, origin: captureDomainOrigin(domainVisit.current?.token ?? null) }
    domainVisits.current.set(visit.token, visit)
    domainVisit.current = visit
    overlayHistoryOwnerRef.current = visit.historyOwner
    setAthleteRecordsOpen(false)
    setUtilityView(visit.domain === "games" ? "minigame" : null)
    const next = overlayHistoryMarker(state, visit.historyOwner)
    applyOverlay(next)
    setOracleHubSection(next?.kind === "running-profile" ? next.initialView === "library" ? "library" : "profile" : "training")
    if (visit.domain === "journal") setV(lastJournalView.current?.owner === activeLocalAccount() ? lastJournalView.current.view : viewForTab("journal"))
    else setV(viewForTab(visit.domain === "oracle" ? "trends" : "home"))
    const section = visit.domain === "oracle" ? next?.kind === "running-profile" ? next.initialView === "library" ? "library" : "profile" : "training"
      : visit.domain === "journal" ? lastJournalView.current?.view.journalSection ?? "JOURNAL" : "games"
    const position = domainPositions.current.get(`${visit.domain}:${section}`)
    if (position) scheduleReturnFrame(() => restoreReaderPosition(scrollRegionRef.current, position))
  }
  const startRecording = (entryType: import("./screens/LogEntry").EntryType = "choose", plannedView?: typeof v) => {
    if (v.tab === "log" && entryType === "choose" && v.entryType === "choose") return
    runViewTransition(tabMotion(v.tab, "log"), () => {
      if (v.tab !== "log") {
        const origin = captureRecordingOrigin(entryType !== "choose")
        const plannedLink = plannedView?.journalDraft?.returnTab === "plan" ? plannedView.journalDraft.plannedSessionLink : undefined
        recordingOrigin.current = plannedLink
          ? { ...origin, view: { ...origin.view, returnToSession: plannedLink } }
          : origin
      }
      dismissOracle()
      if (recordingOrigin.current && window.history.state?.recordingDraft !== recordingOrigin.current.token) {
        window.history.pushState({ ...window.history.state, recordingDraft: recordingOrigin.current.token }, "", window.location.href)
      }
      setUtilityView(null)
      setAthleteRecordsOpen(false)
      setV(plannedView ?? viewForTab("log", entryType))
    }, true)
  }
  const isOraclePlanRecording = (origin: RecordingOrigin | null) => origin !== null
    && origin.owner === activeLocalAccount() && origin.view.tab === "plan"
    && oracleInputRef.current?.inputKind === "plan" && window.history.state?.recordingDraft === origin.token
  const returnFromRecording = () => runViewTransition("pop", () => {
    const origin = recordingOrigin.current
    // A recording entry can carry its enclosing flow's Back marker. Consume
    // the child entry instead of relabelling it as its parent: duplicate parent
    // markers otherwise leave a later flow waiting for a POP that never arrives.
    if (origin && origin.owner === activeLocalAccount() && window.history.state?.recordingDraft === origin.token) {
      window.history.back(); return
    }
    recordingOrigin.current = null
    if (!origin || origin.owner !== activeLocalAccount()) { setV(INITIAL_VIEW_STATE); setUtilityView(null); return }
    restoreRecordingOrigin(origin)
  })
  const restoreReturnPoint = (point: ShellReturnPoint | null) => {
    if (point === null) {
      setV(INITIAL_VIEW_STATE)
      setUtilityView(null)
      setAthleteRecordsOpen(false)
      return
    }
    setV(point.view)
    setUtilityView(point.utilityView)
    setUtilityOrigin(point.utilityOrigin)
    setMoreView(point.moreView)
    setAthleteRecordsOpen(point.athleteRecordsOpen)
  }
  const openTrainingReading = () => runViewTransition("push", () => {
    trainingContentOrigin.current = captureRecordingOrigin(false)
    dismissOracle()
    setUtilityOrigin(utilityView === "more" ? "more" : "home")
    setUtilityView("content")
    setV(viewForTab("home"))
  }, false)
  const openGuide = (section: "guide" | "minji") => runViewTransition("push", () => {
    guideOrigin.current = captureRecordingOrigin(false)
    setUtilityOrigin(utilityView === "more" ? "more" : "home")
    setUtilityView(section)
  })
  const closeGuide = () => runViewTransition("pop", () => {
    const origin = guideOrigin.current
    guideOrigin.current = null
    if (origin && origin.owner === activeLocalAccount()) restoreRecordingOrigin(origin)
    else setUtilityView(utilityOrigin === "home" ? null : "more")
  })
  const openRestore = () => runViewTransition("push", () => {
    restoreReturnRef.current = captureReturnPoint()
    setUtilityView(null)
    setV(s => ({
      ...s,
      tab: "home",
      accountOpen: false,
      importOpen: false,
      restoreOpen: true,
      archiveSelection: null,
    }))
  })
  const closeRestore = () => runViewTransition("pop", () => {
    const point = restoreReturnRef.current
    restoreReturnRef.current = null
    restoreReturnPoint(point)
  })
  const openImport = () => runViewTransition("push", () => {
    importReturnRef.current = captureRecordingOrigin(false)
    setUtilityView(null)
    setAthleteRecordsOpen(false)
    setV(s => ({ ...s, tab: "log", accountOpen: false, restoreOpen: false, importOpen: true }))
  })
  const closeImport = () => runViewTransition("pop", () => {
    const point = importReturnRef.current
    importReturnRef.current = null
    if (point && point.owner === activeLocalAccount()) restoreRecordingOrigin(point)
    else restoreReturnPoint(null)
  })

  const detailScreen = (onBack: () => void, withReader = false) => {
    const common = {
      date: v.detailDate ?? "",
      initialEntryId: v.detailEntryId,
      readComplete: calendarSnapshot.status === "READY",
      onBack,
      onAddEntry: (date: string) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, date))),
      onEditEntry: (entry: JournalEntry) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, entry.date, entry))),
      onJournalSaved: confirmSavedJournalEffects,
    }
    return withReader ? (
      <DeferredMobileScreens.JournalDayReader
        {...common}
        backDestination={v.tab === "home" ? homeDetailOrigin : "journal"}
        entries={loadEntries()}
        onDateChange={(detailDate) => runViewTransition("replace", () => {
          if (v.tab === "journal") rememberCalendarDate(v.journalMode === "CYCLE" ? `cycle:${v.cycleAnchor ?? todayISO()}` : "journal", detailDate)
          setV(s => ({ ...s, detailDate, detailEntryId: undefined }))
        })}
      />
    ) : <DeferredMobileScreens.LogDetail {...common} />
  }

  let screen: React.ReactNode
  if (v.tab === "home" && v.restoreOpen) {
    screen = (
      <DeferredMobileScreens.RestoreBackup
        onBack={closeRestore}
        onOpenJournal={() => goTab("journal")}
      />
    )
  } else if (v.tab === "home" && v.accountOpen && accountEnabled) {
    screen = (
      <DeferredMobileScreens.Account
        loungeRequested={loungeEntryIntent().requested}
        onOpenJournal={() => goTab("journal")}
        onOpenPlan={() => goTab("plan")}
        onBack={() => runViewTransition("pop", () => {
          setOracleEntry({ requested: false, invitation: null }); clearOracleInvitationReturn()
          setV(s => ({ ...s, accountOpen: false }))
        })}
        onOpenImport={openImport}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home" && utilityView === "more") {
    screen = (
      <DeferredMobileScreens.More
        view={moreView}
        connectionOrigin={moreConnectionReturn.current?.view}
        onViewChange={next => runViewTransition(next === "tools" || moreView === "connections" && next === "about" ? "pop" : "push", () => {
          if (moreView === "tools" && next !== "tools") moreReturnPosition.current = captureReaderPosition(scrollRegionRef.current)
          if (next === "connections") moreConnectionReturn.current = { view: moreView, position: captureReaderPosition(scrollRegionRef.current) }
          const state = window.history.state ?? {}
          const marker = state[MORE_HISTORY_KEY]
          if ((next === "tools" || moreView === "connections" && next === "about") && marker?.owner === overlayHistoryOwnerRef.current && marker.view !== "tools") {
            window.history.back()
            return
          }
          if (next !== "tools") {
            window.history.replaceState({ ...state, [MORE_HISTORY_KEY]: { owner: overlayHistoryOwnerRef.current, view: moreView } }, "", window.location.href)
            window.history.pushState({ ...state, [MORE_HISTORY_KEY]: { owner: overlayHistoryOwnerRef.current, view: next } }, "", window.location.href)
          }
          setMoreView(next)
          if (next === "connections") scheduleReturnFrame(() => { if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0 })
        })}
        onBack={() => runViewTransition("pop", () => { moreReturnPosition.current = null; setUtilityView(null) })}
        onOpenMinji={() => openGuide("minji")}
        onOpenGuide={() => openGuide("guide")}
        onOpenContent={openTrainingReading}
        onOpenMinigame={() => runViewTransition("push", () => enterDomain("games"), false)}
        onOpenRewards={() => openDecorationStudio()}
        onOpenPaceCalculator={() => openPaceCalculator()}
        onOpenRunningProfile={() => openOverlay({ kind: "running-profile", stage: "overview" })}
        onOpenRecordReading={() => openOverlay({ kind: "record-reading", stage: "own-event" })}
        onOpenOracleLibrary={oracleV2Enabled() ? () => openOverlay({ kind: "running-profile", stage: "overview", initialView: "library" }) : undefined}
        onOpenRecords={() => openOverlay({ kind: "athlete-records" })}
        onOpenImport={openImport}
        onOpenPlan={() => goTab("plan")}
        onOpenJournal={() => startRecording("quick-session")}
        onOpenAnalysis={() => goTab("trends")}
        onOpenFeedback={() => openOverlay({ kind: "feedback" })}
        onOpenAccount={accountEnabled ? () => runViewTransition("push", () => setV(s => ({ ...s, accountOpen: true }))) : undefined}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home" && utilityView === "minigame") {
    screen = <DeferredMobileScreens.TreadmillGame backLabel={domainVisit.current ? "게임 라운지 나가기" : "홈"} onBack={exitDomain} onJournalSaved={confirmSavedJournalEffects}
      navigationState={gameNavigationState} onNavigationStateChange={setGameNavigationState} />
  } else if (v.tab === "home" && utilityView === "content") {
    screen = <DeferredMobileScreens.TrainingContent onBack={() => runViewTransition("pop", () => {
      const origin = trainingContentOrigin.current
      trainingContentOrigin.current = null
      if (origin && origin.owner === activeLocalAccount()) restoreRecordingOrigin(origin)
      else setUtilityView(utilityOrigin === "home" ? null : "more")
    })} />
  } else if (v.tab === "home" && utilityView === "rewards") {
    screen = <DeferredMobileScreens.JournalRewards
      onBack={closeDecorationStudio}
      initialDate={decorationInitialDate}
      previewMonth={decorationReturn.current?.view.archiveSelection?.selectedMonth ?? undefined}
      onOpenMore={() => runViewTransition("push", () => { setUtilityOrigin("home"); setUtilityView("more") })}
    />
  } else if (v.tab === "home" && (utilityView === "guide" || utilityView === "minji")) {
    screen = <DeferredMobileScreens.Guide
      initialSection={utilityView}
      backLabel={utilityOrigin === "home" ? "홈으로 돌아가기" : "더보기로 돌아가기"}
      onBack={closeGuide}
      onWriteLog={() => runViewTransition("tab-forward", () => { setUtilityView(null); setV(viewForTab("log")) })}
      onOpenDecorations={() => openDecorationStudio()}
      onOpenFeedback={() => openOverlay({ kind: "feedback" })}
    />
  } else if (v.tab === "home") {
    screen = v.detailDate !== null
      ? detailScreen(() => runViewTransition("pop", () => {
        const returnToRewards = homeDetailOrigin === "rewards"
        setV(s => ({ ...s, detailDate: null }))
        setUtilityView(returnToRewards ? "rewards" : null)
      }), true)
      : (
        <Home
          memoReceipt={homeMemoReceipt}
          memoNotice={homeMemoNotice}
          onMemoSaved={(entry, review, storage) => {
            confirmSavedJournalEffects(entry)
            setHomeMemoNotice(null)
            setHomeMemoReceipt({ scopeGeneration: localJournalScopeGeneration(), id: entry.id, kind: entry.kind,
              date: entry.date, savedAt: entry.savedAt, storage: storage ?? "메모·컨디션을 이 기기에 저장했어요.",
              storageStatus: homeMemoReceiptStorageStatus(entry), ...(review ? { review } : {}) })
          }}
          onOpenMemoRecord={() => openHomeMemo(false)}
          onDecorateMemo={() => openHomeMemo(true)}
          onJournalSaved={confirmSavedJournalEffects}
          introductionAllowed={allowHomeIntroduction && overlay === null}
          oraclePreview={homeOraclePreview}
          oraclePreviewLabel={homeCandidate ? "내 기록으로 본 오라클" : homeSourceUnavailable ? "오라클 기록 상태" : homePlanState ? "오라클" : "오라클 결과 예시 보기"}
          onOpenImport={openImport}
          onOpenRecords={() => openOverlay({ kind: "athlete-records", initialPurpose: "PERSONAL_BEST" })}
          onWriteLog={(entryType) => startRecording(entryType)}
          onOpenDay={(date, entryId) => runViewTransition("push", () => {
            setHomeDetailOrigin("home")
            setV(s => ({ ...s, detailDate: date, detailEntryId: entryId }))
          })}
          onDecorateToday={() => openDecorationStudio()}
          onOpenArchive={() => runViewTransition("push", () => {
            enterDomain("journal")
            setV(current => ({ ...current, journalMode: "CALENDAR" }))
          }, false)}
          onOpenGuide={() => openGuide("minji")}
          onOpenPlan={() => goTab("plan")}
          onOpenTrends={() => goTab("trends", { section: "distance" })}
          onOpenOracle={topic => openOracle(topic, "personal")}
          onOpenMore={() => runViewTransition("push", () => setUtilityView("more"))}
          onOpenMinigame={() => runViewTransition("push", () => enterDomain("games"), false)}
          onOpenAccount={accountEnabled ? () => runViewTransition("push", () => setV(s => ({ ...s, accountOpen: true }))) : undefined}
          onOpenContent={openTrainingReading}
          onOpenRewards={() => openDecorationStudio()}
          onOpenNextTraining={(link: PlannedSessionLink) => runViewTransition("tab-forward", () => {
            setAthleteRecordsOpen(false)
            setUtilityView(null)
            setV({ ...viewForTab("plan"), returnToSession: link })
          })}
        />
      )
  } else if (v.tab === "journal") {
    const selection = v.archiveSelection ?? { selectedMonth: null, selectedWeekStart: null }
    screen = v.detailDate !== null
      ? detailScreen(() => {
        const coachingOrigin = coachingDayOrigin.current
        if (coachingOrigin) {
          if (domainVisit.current?.domain === "journal") {
            coachingDayOrigin.current = null
            exitDomain()
            return
          }
          runViewTransition("pop", () => {
            coachingDayOrigin.current = null
            if (coachingOrigin.owner === activeLocalAccount()) restoreRecordingOrigin(coachingOrigin)
            else setV(INITIAL_VIEW_STATE)
          })
          return
        }
        if (calendarOriginalReturn.current && window.history.state?.calendarOriginalPage === calendarOriginalReturn.current.token) window.history.back()
        else runViewTransition("pop", () => {
          const origin = calendarOriginalReturn.current
          if (origin) restoreCalendarOriginal(origin)
          else setV(s => ({ ...s, detailDate: null, detailEntryId: undefined }))
        })
      }, true)
      : (
        <DeferredMobileScreens.JournalArchive
          entries={calendarSnapshot.entries}
          readiness={calendarSnapshot.status}
          onRetry={calendarSnapshot.retry}
          selection={selection}
          calendarReturn={calendarReaderReturn}
          onCalendarReturnConsumed={() => setCalendarReaderReturn(null)}
          mode={v.journalMode}
          section={v.journalSection}
          onSectionChange={journalSection => setV(s => ({ ...s, journalSection }))}
          bodyPartId={v.bodyHistoryPartId}
          onBodyPartChange={bodyHistoryPartId => setV(s => ({ ...s, bodyHistoryPartId }))}
          onWriteBody={partId => startRecording("evening", { ...viewForTab("log", "evening"),
            bodyInputPartId: partId ?? "" })}
          cycleAnchor={v.cycleAnchor}
          cycleIndex={v.cyclePositionSet ? v.cycleIndex : undefined}
          onModeChange={(journalMode) => setV(s => ({ ...s, journalMode }))}
          onCycleAnchorChange={(cycleAnchor) => setV(s => ({ ...s, cycleAnchor, cycleIndex: 0, cyclePositionSet: true }))}
          onCycleIndexChange={(cycleIndex) => setV(s => ({ ...s, cycleIndex, cyclePositionSet: true }))}
          onWriteDate={(date) => runViewTransition("push", () => {
            const token = `calendar-draft-${Date.now()}`
            // Reuse the reader's history entry so one Back returns to its calendar.
            const { [READER_HISTORY_KEY]: reader, ...rest } = window.history.state ?? {}
            try {
              window.history[reader ? "replaceState" : "pushState"]({ ...rest, calendarDraft: token }, "", window.location.href)
              calendarDraftReturn.current = { token, owner: activeLocalAccount(), view: v }
            } catch { /* The in-app Back action still retains the selected date. */ }
            setV(s => viewForJournalDraft(s, date))
          })}
          onSelectionChange={(archiveSelection) => setV(s => ({ ...s, archiveSelection }))}
          onOpenDay={(detailDate, entryId, calendarReturn) => runViewTransition("push", () => {
            const token = `calendar-original-${Date.now()}`
            const { [READER_HISTORY_KEY]: reader, ...rest } = window.history.state ?? {}
            // This archive unmounts for the original. Replace its Back sentinel
            // instead of inheriting it: disposal must not pop the new reader.
            const bodyReader = v.journalSection === "BODY"
            if (bodyReader) delete rest[BROWSER_BACK_LAYER_HISTORY_KEY]
            setCalendarReaderReturn(null)
            // Keep return context in this owner only, not in browser history or storage.
            calendarOriginalReturn.current = { token, owner: activeLocalAccount(),
              view: { ...v, detailDate: null, detailEntryId: undefined },
              calendarReturn: validJournalCalendarReturn(calendarReturn, calendarSnapshot.entries),
              position: captureCalendarReaderPosition(scrollRegionRef.current, detailDate) }
            try {
              window.history[reader || bodyReader ? "replaceState" : "pushState"]({ ...rest, calendarOriginalPage: token }, "", window.location.href)
            } catch { /* In-app Back still returns to the archive. */ }
            setV(s => ({ ...s, detailDate, detailEntryId: entryId }))
          })}
          onBack={goHome}
          onWriteLog={() => goTab("log")}
        />
      )
  } else if (v.tab === "plan") {
    screen = athleteRecordsOpen ? (
      <DeferredMobileScreens.AthleteRecords
        onBack={returnToOracleAfterRecord}
        onSaved={oracleInputRef.current ? returnToOracleAfterRecord : undefined}
        backLabel={oracleInputRef.current ? "오라클로" : "계획으로"}
      />
    ) : (
      <>
        {productFeatures().planProposals && <DeferredMobileScreens.PlanProposalInbox />}
        <DeferredMobileScreens.PlanBeta
          multiAdjustmentResolverV3={multiPlanRuntime?.multiAdjustmentResolverV3}
          readMultiAdjustedEvidenceV3={multiPlanRuntime?.readMultiAdjustedEvidenceV3}
          onManageRecords={() => runViewTransition("push", () => setAthleteRecordsOpen(true))}
          onWriteLog={(entryType) => startRecording(entryType)}
          onWritePlannedSessionLog={(draft) => startRecording("quick-session", viewForPlannedSessionDraft(v, draft))}
          returnToSession={v.returnToSession}
        />
      </>
    )
  } else if (v.tab === "log" && v.importOpen) {
    screen = (
      <DeferredMobileScreens.ImportActivities
        reviewSession={importReviewSession.current}
        onBack={closeImport}
        onOpenLog={() => goTab("journal")}
        onOpenEntry={(date, entryId) => openOverlay({ kind: "imported-records", date, entryId })}
        onOpenAnalysis={() => goTab("trends", { section: "files" })}
        onOpenSummary={() => { importedListPosition.current = null; openOverlay({ kind: "imported-records" }) }}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        targetDate={v.journalDraft?.date}
        initialEntry={v.journalDraft?.initialEntry}
        plannedSessionLink={v.journalDraft?.plannedSessionLink}
        initialBodyPartId={v.bodyInputPartId}
        onExit={oracleInputRef.current?.inputKind === "log" ? returnFromOracleInput
          : recordingOrigin.current ? returnFromRecording
          : v.journalDraft ? () => runViewTransition("pop", () => setV(viewForJournalReturn(v))) : goHome}
        onBack={oracleInputRef.current?.inputKind === "log" ? returnFromOracleInput : recordingOrigin.current && (v.entryType === "choose" || recordingOrigin.current.direct)
          ? returnFromRecording : v.entryType === "choose"
          ? v.journalDraft === undefined
            ? goHome
            : () => runViewTransition("pop", () => setV(viewForJournalReturn(v)))
          : v.journalDraft?.initialEntry !== undefined || v.journalDraft?.plannedSessionLink !== undefined
            ? () => runViewTransition("pop", () => setV(viewForJournalReturn(v)))
            : () => runViewTransition("pop", () => setV(s => ({ ...s, entryType: "choose" })))}
        onOpenImport={openImport}
        onContinueDetailed={(entry) => runViewTransition("replace", () => setV((state) => viewForJournalDraft(state, entry.date, entry)))}
        onSaved={(entry, reviewMessage, storageMessage) => {
          const reward = confirmSavedJournalEffects(entry)
          // Quick owns its completion screen. Show only the existing receipt
          // notice now, so Back/closing never withholds confirmed reward status.
          setSavedToast({ count: localOnlyCount(), phase: "enter", receipt: createSavedFactReceipt(entry),
            storageStatus: "CONFIRMED", savedJournal: { id: entry.id, date: entry.date, kind: entry.kind }, reviewMessage, storageMessage,
            rewardMessage: reward.rewardMessage, rewardRetry: reward.rewardRetry, completionAlreadyShown: true })
        }}
        onDone={(picked, savedEntry, reviewMessage, storageMessage) => {
          if (v.entryType === "choose") {
            runViewTransition("push", () => setV(s => ({ ...s, entryType: picked })))
          } else if (savedEntry !== undefined) {
            goHomeAfterSave(savedEntry, reviewMessage, v.journalDraft?.date, storageMessage, v.entryType === "quick-session")
          }
        }}
      />
    )
  } else if (v.tab === "trends") {
    screen = (
      <DeferredMobileScreens.Trends
        key={`${analysisContext?.section ?? "summary"}-${analysisContext?.metric ?? "default"}-${analysisContext?.savedDate ?? ""}`}
        initialContext={analysisContext}
        initialOracleSection={oracleHubSection}
        oracleV2Enabled={oracleV2Enabled()}
        journalReadComplete={calendarSnapshot.status === "READY" && oracleHistory.journalReadComplete}
        journalReadState={calendarSnapshot.status === "LOADING" ? "loading" : calendarSnapshot.status === "READY" && oracleHistory.journalReadComplete ? "ready" : "error"}
        onRetryJournalRead={() => { calendarSnapshot.retry?.(); oracleHistory.retry() }}
        onOracleSectionChange={setOracleHubSection}
        onContextChange={context => { analysisReturnContext.current = context }}
        onOpenCoachingDay={(date, entryId) => runViewTransition("push", () => {
          coachingDayOrigin.current = captureRecordingOrigin(false)
          enterDomain("journal")
          setV({ ...viewForTab("journal"), detailDate: date, detailEntryId: entryId })
        })}
        onBack={goHome}
        onWriteLog={() => goTab("log")}
        onOpenImport={openImport}
        onOpenRecords={() => openOverlay({ kind: "athlete-records", initialPurpose: "PERSONAL_BEST" })}
        onWriteRecovery={() => startRecording("evening")}
        onOpenPlan={() => goTab("plan")}
        onOpenOracle={openOracle}
        onOpenRecordReading={() => openOverlay({ kind: "record-reading", stage: "own-event" })}
        onOpenRunningProfile={() => switchOracleSection("profile")}
        onOpenOracleLibrary={oracleV2Enabled() ? () => switchOracleSection("library") : undefined}
        onOpenTrainingContent={openTrainingReading}
      />
    )
  }

  function openPaceCalculator(request: PaceToolRequest = {}) {
    const token = `pace-${Date.now()}-${Math.random().toString(36).slice(2)}`
    paceRequestRef.current = { token, owner: activeLocalAccount(), request, consumed: false,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null }
    openOverlay({ kind: "pace", stage: request.record ? "result" : "event", token, depth: 1 })
  }

  const preservedRecording = v.tab === "log" ? recordingOrigin.current : null
  const baseScreenKey = preservedRecording?.screenKey ?? screenKey
  const oracleSectionOpen = overlay?.kind === "running-profile" && oracleV2Enabled()
  const activeDomain: NavigationDomain | null = oracleSectionOpen || v.tab === "trends" ? "oracle"
    : v.tab === "journal" ? "journal" : v.tab === "home" && utilityView === "minigame" ? "games" : null
  const fallbackDock: DomainDockState | null = activeDomain === "oracle" ? {
    domain: "oracle", current: oracleSectionOpen ? oracleHubSection : "training", onSelect: section => {
      if (section === "training" || section === "profile" || section === "library") switchOracleSection(section)
    },
  } : activeDomain === "journal" ? {
    domain: "journal", current: v.journalSection ?? "JOURNAL", onSelect: section => {
      if (section === "JOURNAL" || section === "BODY") switchJournalSection(section)
    },
  } : activeDomain === "games" ? { domain: "games", current: "games", onSelect: () => undefined } : null
  const currentDock = fallbackDock?.domain === "oracle" || fallbackDock?.domain === "journal" ? fallbackDock
    : publishedDock?.state.domain === activeDomain ? publishedDock.state : fallbackDock
  return (
    <MultiPlanEvidenceContext.Provider value={multiPlanRuntime?.readMultiAdjustedEvidenceV3}>
    <DomainNavigationProvider publish={publishDock} onRecord={() => startRecording()}>
    <AppOverlayNavigationProvider
      openPaceCalculator={openPaceCalculator}
      openTrainingTerm={(term) => openOverlay({ kind: "term", term })}
      openFeedback={() => openOverlay({ kind: "feedback" })}
    >
    <AppShellFrame
      systemStatus={systemStatus}
      scrollRegionRef={scrollRegionRef}
      savedToast={savedToast}
      tab={oracleSectionOpen ? "trends" : v.tab === "log" && recordingOrigin.current ? tabForChrome(recordingOrigin.current.view) : tabForChrome(v)}
      onDismissToast={() => setSavedToast(null)}
      onRetryReward={retrySavedReward}
      onOpenTrends={goTrendsFromReceipt}
      onDecorateSaved={() => { const date = savedToast?.receipt.savedDate; if (date && loadEntries().some(entry => entry.date === date)) openDecorationStudio(date) }}
      onOpenSaved={() => {
        const savedJournal = savedToast?.savedJournal
        const date = savedJournal?.date ?? savedToast?.receipt.savedDate
        if (!date || !loadEntries().some(entry => entry.date === date
          && (!savedJournal || entry.id === savedJournal.id && entry.kind === savedJournal.kind))) return
        runViewTransition("push", () => {
          const recording = recordingOrigin.current
          const origin = recording && recording.owner === activeLocalAccount()
            ? captureDomainOrigin(domainVisit.current?.token ?? null, recording) : undefined
          if (origin && recording && window.history.state?.recordingDraft === recording.token) {
            const { recordingDraft: _recording, ...state } = window.history.state
            window.history.replaceState(state, "", window.location.href)
          }
          setSavedToast(null)
          enterDomain("journal", undefined, undefined, origin)
          setV({ ...viewForTab("journal"), detailDate: date, detailEntryId: savedJournal?.id })
        })
      }}
      onOpenBackup={() => {
        setSavedToast(null)
        openRestore()
      }}
      onTab={goTab}
      onStartRecording={() => startRecording()}
      domainDock={currentDock ? { state: currentDock, hasOrigin: domainVisit.current !== null && !domainVisit.current.direct, onExit: exitDomain } : undefined}
      hideTabBar={v.tab === "log" || (overlay !== null && overlay.kind !== "oracle" && !oracleSectionOpen)
        || currentDock?.hidden === true}
      wideTask={overlay === null && (v.tab === "log" || v.tab === "plan")}
      wideResults={overlay === null ? v.tab === "trends" || (v.tab === "home" && utilityView === "more" && !v.accountOpen && !v.restoreOpen)
        : overlay.kind === "running-profile" || overlay.kind === "oracle"
          || (overlay.kind === "record-reading" && (overlay.stage === "self-result" || overlay.stage === "pair-result"))}
    >
      <React.Suspense fallback={<AppLoadingState />}>
        <DomainNavigationScope active={overlay === null && preservedRecording === null}>
        <div
          key={`${baseScreenKey}:account-scope-${accountScopeRevision}`}
          className="app-flow-stage"
          data-motion={currentScreenMotion}
          hidden={overlay !== null || preservedRecording !== null}
        >
          <ErrorBoundary key={`${baseScreenKey}:account-scope-${accountScopeRevision}`} region recoveryTab={tabForChrome(v)}>
            {preservedRecording?.screen ?? screen}
          </ErrorBoundary>
        </div>
        </DomainNavigationScope>
        {preservedRecording !== null && (
          <div key={`${screenKey}:recording:${accountScopeRevision}`} className="app-flow-stage" data-motion={currentScreenMotion} hidden={overlay !== null}>
            <ErrorBoundary key={`${screenKey}:recording:${accountScopeRevision}`} region recoveryTab={tabForChrome(v)}>{screen}</ErrorBoundary>
          </div>
        )}
        <ErrorBoundary key={`overlay-${overlay?.kind ?? "none"}-${accountScopeRevision}`} region onExit={closeOverlay} recoveryTab={tabForChrome(v)}>
        {/* Loading a reader must not suspend the retained draft's layout effects
            and dispose its native Back layer underneath the new overlay entry. */}
        <React.Suspense fallback={<AppLoadingState />}>
        {overlay?.kind === "imported-records" && <ImportedRecords entries={calendarSnapshot.entries} readComplete={calendarSnapshot.status === "READY"}
          readUnavailable={calendarSnapshot.status === "STALE" || calendarSnapshot.status === "ERROR"} onRetry={calendarSnapshot.retry}
          selected={overlay.date && overlay.entryId ? { date: overlay.date, id: overlay.entryId } : undefined}
          onBack={closeOverlay} onOpenEntry={(date, entryId) => {
            importedListPosition.current = captureReaderPosition(scrollRegionRef.current)
            openOverlay({ kind: "imported-records", date, entryId })
          }} />}
        {overlay?.kind === "athlete-records" && <DeferredMobileScreens.AthleteRecords initialPurpose={overlay.initialPurpose}
          backLabel={utilityView === "more" ? "더보기로" : v.tab === "trends" ? "오라클로" : "홈으로"} onBack={closeOverlay} />}
        {overlay?.kind === "pace" && paceRequestRef.current?.token === overlay.token && (
          <DeferredMobileScreens.PaceCalculator key={overlay.token} stage={overlay.stage}
            request={{ ...paceRequestRef.current.request, ...(paceRequestRef.current.request.onSelectRecord ? {
              onSelectRecord: record => {
                const context = paceRequestRef.current
                if (!context || context.token !== overlay.token || context.consumed || context.owner !== activeLocalAccount() || !isEligiblePaceRecordCurrent(record)) return false
                if (context.request.onSelectRecord?.(record) === false) return false
                context.consumed = true
                window.history.go(-overlay.depth)
                return true
              },
            } : {}) }}
            onStageChange={stage => { if (stage !== overlay.stage) openOverlay({ kind: "pace", stage, token: overlay.token, depth: overlay.depth + 1 }) }}
            onBack={closeOverlay} />
        )}
        {overlay?.kind === "term" && (
          <div className="app-flow-stage" data-motion="push" data-overlay="training-term">
            <DeferredMobileScreens.TrainingLexicon
              key={overlay.term}
              initialTerm={overlay.term}
              directEntry
              onBack={closeOverlay}
              onNavigateTerm={(term) => openOverlay({ kind: "term", term })}
            />
          </div>
        )}
        {overlay?.kind === "feedback" && (
          <div className="app-flow-stage" data-motion="push" data-overlay="feedback">
            <DeferredMobileScreens.FeedbackBoard onBack={closeOverlay} />
          </div>
        )}
        {overlay?.kind === "running-profile" && (
          <div className="app-flow-stage" data-overlay="running-profile">
            {oracleV2Enabled() ?
              <DeferredMobileScreens.OracleProfileV2 key={`oracle-v2-${accountScopeRevision}-${oracleEntryRevision}`} today={todayISO()} onBack={closeOverlay}
                navigationState={profileNavigationState} onNavigationStateChange={setProfileNavigationState}
                onOpenTraining={() => switchOracleSection("training")}
                onOpenLibrary={() => switchOracleSection("library")}
                initialView={overlay.initialView}
                backLabel={utilityView === "more" ? "더보기로 돌아가기" : v.tab === "trends" ? "오라클로 돌아가기" : v.tab === "plan" ? "훈련으로 돌아가기" : v.tab === "journal" ? "일지로 돌아가기" : "홈으로 돌아가기"}
                guestSession={activeLocalAccount() === null ? guestOracleSession : undefined}
                onGuestSessionChange={session => {
                  if (guestScopeGeneration === localJournalScopeGeneration() && activeLocalAccount() === null
                    && (session === null || session.ownerKey === "guest")) setGuestOracleSession(session)
                }}
                onNavigate={destination => runDraftSafeNavigation(() => {
                  if (destination === "RECORDS") openOraclePersonal("records")
                  else if (destination === "JOURNAL") openOraclePersonal("journal")
                  else if (destination === "METHODS") openTrainingReading()
                  else openOraclePersonal("plan")
                })} /> : <DeferredMobileScreens.RunningProfile key={`running-profile-${accountScopeRevision}`}
              stage={overlay.stage} today={todayISO()}
              onStageChange={stage => openOverlay({ kind: "running-profile", stage })}
              onBack={closeOverlay} onClose={() => runDraftSafeNavigation(dismissOracle)} />}
          </div>
        )}
        {overlay?.kind === "record-reading" && (
          <div className="app-flow-stage" data-overlay="record-reading">
            <DeferredMobileScreens.RecordReadingOracle
              key={`record-reading-${accountScopeRevision}`}
              stage={overlay.stage}
              today={todayISO()}
              onStageChange={stage => openOverlay({ kind: "record-reading", stage })}
              onBack={closeOverlay}
              onClose={dismissOracle}
              onOpenPlan={() => goTab("plan")}
            />
          </div>
        )}
        {overlay?.kind === "oracle" && (
          <div className="app-flow-stage" data-motion="push" data-overlay="oracle">
            {overlay.topic === "level" && overlay.mode !== "example" && athleteRecords.status !== "READY" ? <>
              <button type="button" onClick={closeOverlay}>돌아가기</button>
              <p role={athleteRecords.status === "LOADING" ? "status" : "alert"}>{athleteRecords.message}</p>
              {athleteRecords.status !== "LOADING" && <button type="button" onClick={() => openOraclePersonal("records")}>경기 기록 확인</button>}
            </> :
            <DeferredMobileScreens.OracleExplore
              key={`${overlay.topic}-${overlay.mode ?? "auto"}-${accountScopeRevision}`}
              topicId={overlay.topic}
              personalResult={oracleResult}
              personalResultUnavailable={overlay.topic === "level" ? athleteRecords.status !== "READY"
                : calendarSnapshot.status !== "READY" || !oracleHistory.journalReadComplete}
              personalReadStatus={oracleReadStatus}
              onRetryPersonalResult={overlay.topic === "level" ? undefined : () => {
                if (oracleReadScope !== localJournalScopeGeneration() || oracleReadStatus === "loading") return
                calendarSnapshot.retry?.()
                oracleHistory.retry()
              }}
              historyNotice={oracleUsesPlan && oracleHistory.status !== "ready"
                ? <PlanEvidenceHistoryNotice status={oracleHistory.status} onRetry={oracleHistory.retry} /> : undefined}
              initialMode={overlay.mode}
              onModeChange={changeOracleMode}
              onBack={closeOverlay}
              onSelectTopic={openOracle}
              onPersonalAction={openOraclePersonal}
            />
            }
          </div>
        )}
        </React.Suspense>
        </ErrorBoundary>
      </React.Suspense>
    </AppShellFrame>
    </AppOverlayNavigationProvider>
    </DomainNavigationProvider>
    </MultiPlanEvidenceContext.Provider>
  )
}

export { useIsMobileShell } from "./components/AppShellFrame"
export { SavedToast } from "./components/AppChrome"
