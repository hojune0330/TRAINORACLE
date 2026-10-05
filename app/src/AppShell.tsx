import React from "react"
import { READER_HISTORY_KEY } from "./hooks/useReaderDialog"
import { useCalendarSnapshot } from "./hooks/useCalendarEntries"
import { rememberCalendarDate } from "./hooks/useCalendarPosition"
import { runDraftSafeNavigation } from "./domain/unsaved-draft-navigation"
import type { AppTab } from "./components/AppChrome"
import { AppShellFrame } from "./components/AppShellFrame"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { clearRecoveryTab, readRecoveryTab } from "./domain/screen-recovery"
import type { ShellToastState } from "./components/AppShellFrame"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import { DeferredMobileScreens } from "./DeferredMobileScreens"
import { accountFeatureEnabled } from "./domain/account/config"
import { loungeEntryIntent } from "./domain/lounge/entry-intent"
import { loadEntries, localOnlyCount, todayISO } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { awardJournalEntry, type EngagementAwardResult } from "./domain/engagement"
import { ACCOUNT_REWARD_EVENT, accountRewardsEnabled, accountRewardStatus, readAccountRewardSummary } from "./domain/account/account-reward-service"
import { createSavedFactReceipt } from "./domain/save-receipt"
import { analysisNavigationForReceipt, type AnalysisNavigation, type AnalysisSection } from "./domain/analysis-navigation"
import { buildOraclePersonalResult } from "./domain/oracle-personal-result"
import { loadPlanBetaState } from "./domain/plan-beta-store"
import { usePlanEvidenceHistory } from "./hooks/usePlanEvidenceHistory"
import { PlanEvidenceHistoryNotice } from "./components/PlanEvidenceHistoryNotice"
import { useAthleteRecordsSnapshot } from "./hooks/useAthleteRecordsSnapshot"
import { recordOracleJournalParticipation } from "./domain/oracle-participation"
import { trackProductEvent } from "./domain/account/product-analytics-service"
import { currentUser, onAuthChange } from "./domain/account/auth"
import { setAccountAuthState } from "./domain/account/account-auth-state"
import type { PlannedSessionLink } from "./domain/planned-session-link"
import {
  onLocalJournalScopeChange,
  activeLocalAccount,
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
import { isOracleTopicId, type OracleTopicId } from "./domain/oracle-exploration"
import { isReadingStage, type ReadingStage } from "./domain/record-reading-oracle"
import { isRunningProfileStage, type RunningProfileStage } from "./domain/running-profile"
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
const ORACLE_INVITATION_RETURN_KEY = "trainoracle.oracle-v2.invitation-return"

function oracleV2Enabled(): boolean {
  return import.meta.env.VITE_FEATURE_ORACLE_V2 === "true" && import.meta.env.VITE_KILL_ORACLE_V2 !== "true"
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
  | { readonly kind: "running-profile"; readonly stage: RunningProfileStage }
  | { readonly kind: "record-reading"; readonly stage: ReadingStage }
  | { readonly kind: "term"; readonly term: TermId }
  | { readonly kind: "feedback" }
  | { readonly kind: "oracle"; readonly topic: OracleTopicId; readonly mode?: "example" | "personal"; readonly scrollTop?: number }

type OverlayHistoryMarker = AppOverlay & {
  readonly owner: string
  readonly version: 1
}

type ShellReturnPoint = {
  readonly view: ReturnType<typeof viewForTab>
  readonly utilityView: "more" | "guide" | "minji" | "content" | "rewards" | null
  readonly utilityOrigin: "home" | "more"
  readonly athleteRecordsOpen: boolean
}

function overlayHistoryMarker(state: unknown, owner: string): AppOverlay | null {
  if (typeof state !== "object" || state === null) return null
  const marker = (state as Record<string, unknown>)[OVERLAY_HISTORY_KEY]
  if (typeof marker !== "object" || marker === null) return null
  const value = marker as Record<string, unknown>
  if (value.version !== 1 || value.owner !== owner) return null
  if (value.kind === "feedback") return { kind: "feedback" }
  if (value.kind === "record-reading" && isReadingStage(value.stage)) return { kind: "record-reading", stage: value.stage }
  if (value.kind === "running-profile" && isRunningProfileStage(value.stage)) return { kind: "running-profile", stage: value.stage }
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

export function AppShell({ multiPlanRuntime }: { readonly multiPlanRuntime?: AppShellMultiPlanRuntime } = {}) {
  const calendarSnapshot = useCalendarSnapshot()
  const [oracleEntry, setOracleEntry] = React.useState(initialOracleEntry)
  const [oracleEntryRevision, refreshOracleEntry] = React.useReducer((revision: number) => revision + 1, 0)
  const [oracleAuthResolved, setOracleAuthResolved] = React.useState(() => !accountFeatureEnabled())
  const [accountScopeRevision, setAccountScopeRevision] = React.useState(0)
  const [, refreshAccountJournals] = React.useReducer((revision: number) => revision + 1, 0)
  const [v, setV] = React.useState(() => {
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
  const [savedToast, setSavedToast] = React.useState<ShellToastState | null>(null)
  const [analysisContext, setAnalysisContext] = React.useState<AnalysisNavigation | undefined>()
  const oracleInputRef = React.useRef<{ topic: OracleTopicId; owner: string | null; inputKind: "log" | "records" | "plan"; mode: "example" | "personal"; scrollTop: number; view: ReturnType<typeof viewForTab> } | null>(null)
  const pendingReward = React.useRef<{ ownerId: string | null; date: string } | null>(null)
  const calendarDraftReturn = React.useRef<{ token: string; owner: string | null; view: typeof v } | null>(null)
  const calendarOriginalReturn = React.useRef<{ token: string; owner: string | null; view: typeof v } | null>(null)
  const lastJournalView = React.useRef<{ owner: string | null; view: typeof v } | null>(null)
  React.useEffect(() => {
    if (v.tab === "journal") lastJournalView.current = { owner: activeLocalAccount(), view: { ...v, detailDate: null, detailEntryId: undefined } }
  }, [v])
  React.useEffect(() => onLocalJournalScopeChange(() => {
    lastJournalView.current = null; calendarOriginalReturn.current = null
    setV(state => state.tab === "journal" ? { ...viewForTab("journal") } : state)
  }), [])
  const [athleteRecordsOpen, setAthleteRecordsOpen] = React.useState(false)
  const [homeDetailOrigin, setHomeDetailOrigin] = React.useState<"home" | "rewards">("home")
  const scrollRegionRef = React.useRef<HTMLElement>(null)
  const [utilityView, setUtilityView] = React.useState<"more" | "guide" | "minji" | "content" | "rewards" | null>(null)
  const [utilityOrigin, setUtilityOrigin] = React.useState<"home" | "more">("more")
  const [decorationInitialDate, setDecorationInitialDate] = React.useState<string | undefined>()
  const decorationReturn = React.useRef<{ owner: string | null; view: typeof v; utility: typeof utilityView; scroll: number; focusLabel: string | null; focusText: string | null } | null>(null)
  const [overlay, setOverlay] = React.useState<AppOverlay | null>(null)
  const overlayRef = React.useRef<AppOverlay | null>(null)
  const overlayScrollTopRef = React.useRef(0)
  const overlayHistoryOwnerRef = React.useRef(`shell-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const restoreReturnRef = React.useRef<ShellReturnPoint | null>(null)
  const importReturnRef = React.useRef<ShellReturnPoint | null>(null)
  const pendingScreenMotionRef = React.useRef<Exclude<AppScreenMotion, "initial" | "none"> | null>(null)
  const runViewTransition = React.useCallback((
    motion: Exclude<AppScreenMotion, "initial" | "none">,
    update: () => void,
  ) => {
    // The remounted app-flow-stage supplies the non-blocking CSS transition.
    // Native document snapshots block rapid follow-up taps on mobile.
    runDraftSafeNavigation(() => {
      pendingScreenMotionRef.current = motion
      update()
    })
  }, [])

  const applyOverlay = React.useCallback((next: AppOverlay | null) => {
    overlayRef.current = next
    setOverlay(next)
    window.requestAnimationFrame(() => {
      const scrollRegion = scrollRegionRef.current
      if (scrollRegion === null) return
      scrollRegion.scrollTop = next === null ? overlayScrollTopRef.current : next.kind === "oracle" ? next.scrollTop ?? 0 : 0
      scrollRegion.scrollLeft = 0
    })
  }, [])

  const openOverlay = React.useCallback((next: AppOverlay) => {
    if (overlayRef.current === null) overlayScrollTopRef.current = scrollRegionRef.current?.scrollTop ?? 0
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
    const resultStages = ["preferences", "records", "training", "changes"]
    const addsProfileHistory = overlayRef.current?.kind === "running-profile"
      && (next.kind !== "running-profile" || overlayRef.current.stage !== next.stage
        && !(resultStages.includes(overlayRef.current.stage) && resultStages.includes(next.stage)))
    const method = overlayRef.current === null || addsTermHistory || addsOracleHistory || addsReadingHistory || addsProfileHistory ? "pushState" : "replaceState"
    if (addsOracleHistory && overlayRef.current?.kind === "oracle") {
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
      setV(state => ({ ...state, accountOpen: false }))
      refreshOracleEntry()
      openOverlay({ kind: "running-profile", stage: "overview" })
      setOracleEntry({ requested: false, invitation: null })
      clearOracleInvitationReturn()
    })
  }, [oracleEntry, oracleAuthResolved, accountScopeRevision, applyOverlay, openOverlay])

  React.useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
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
          calendarOriginalReturn.current = null
          setV(originalOrigin.owner === activeLocalAccount() ? originalOrigin.view : INITIAL_VIEW_STATE)
        })
        if (!allowed) window.history.pushState({ ...window.history.state, calendarOriginalPage: originalOrigin.token }, "", window.location.href)
        return
      }
      const intent = oracleInputRef.current
      if (intent?.inputKind === "log" && overlayRef.current === null && intent.owner === activeLocalAccount()) {
        const restored: AppOverlay = { kind: "oracle", topic: intent.topic, mode: intent.mode, scrollTop: intent.scrollTop }
        const allowed = runDraftSafeNavigation(() => {
          oracleInputRef.current = null
          setV(intent.view)
          window.history.replaceState({ ...window.history.state, [OVERLAY_HISTORY_KEY]: {
            ...restored, owner: overlayHistoryOwnerRef.current, version: 1,
          } }, "", window.location.href)
          applyOverlay(restored)
        })
        if (!allowed) window.history.pushState({}, "", window.location.href)
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
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [applyOverlay])

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
      const rewardMessage = !summary ? "계정 포인트를 확인하지 못했어요. 나중에 다시 확인해 주세요."
        : summary.today === pending.date && summary.journalRecordedToday
          ? "오늘 기록 포인트가 계정에 반영돼 있어요."
          : "계정 기록을 확인했어요. 현재 추가 적립된 기록 포인트는 없어요."
      setSavedToast(current => current?.rewardMessage === JOURNAL_REWARD_MESSAGE.PENDING ? { ...current, rewardMessage } : current)
      pendingReward.current = null
    }
    const scope = () => { pendingReward.current = null; oracleInputRef.current = null; decorationReturn.current = null; setDecorationInitialDate(undefined); setSavedToast(null); setAnalysisContext(undefined) }
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
    let mounted = true
    let authEventSeen = false
    setAccountAuthState("RESOLVING")
    const refresh = () => setAccountScopeRevision((value) => value + 1)
    // Hydration refreshes readers without remounting a volatile account draft.
    window.addEventListener("trainoracle:account-journals-changed", refreshAccountJournals)
    const unsubscribeScope = onLocalJournalScopeChange(refresh)
    void currentUser({ throwOnFailure: true }).then((user) => {
      if (mounted && !authEventSeen) {
        setActiveLocalAccount(user?.id ?? null)
        setAccountAuthState(user ? "RESOLVING" : "GUEST")
        setOracleAuthResolved(true)
      }
    }).catch(() => {
      if (mounted && !authEventSeen) {
        setAccountAuthState("FAILED")
        setActiveLocalAccount(null)
        setOracleAuthResolved(true)
      }
    })
    const unsubscribeAuth = onAuthChange((user) => {
      authEventSeen = true
      setActiveLocalAccount(user?.id ?? null)
      setAccountAuthState(user ? "RESOLVING" : "GUEST")
      setOracleAuthResolved(true)
    }, { ignoreInitialSession: true })
    return () => {
      mounted = false
      window.removeEventListener("trainoracle:account-journals-changed", refreshAccountJournals)
      unsubscribeScope()
      unsubscribeAuth()
      setAccountAuthState("RESOLVING")
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
      oracleInputRef.current = null
      setAthleteRecordsOpen(false)
      setUtilityView(null)
      setHomeDetailOrigin("home")
      setV(INITIAL_VIEW_STATE)
    })
  }
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string, detailDate?: string, storageMessage?: string) => {
    recordOracleJournalParticipation(savedEntry)
    const receipt = createSavedFactReceipt(savedEntry)
    const reward = awardJournalEntry(savedEntry, todayISO())
    pendingReward.current = reward.kind === "PENDING" ? { ownerId: activeLocalAccount(), date: savedEntry.date } : null
    const rewardMessage = JOURNAL_REWARD_MESSAGE[reward.kind]
    runViewTransition("replace", () => {
      setUtilityView(null)
      setV(detailDate === undefined ? INITIAL_VIEW_STATE : viewForJournalReturn(v))
      setSavedToast({ count: localOnlyCount(), phase: "enter", receipt, reviewMessage, storageMessage, rewardMessage })
      const intent = oracleInputRef.current
      oracleInputRef.current = null
      if (reviewMessage === undefined && intent && intent.owner === activeLocalAccount()) {
        setV(intent.view)
        openOverlay({ kind: "oracle", topic: intent.topic, mode: "personal" })
      }
    })
    void trackProductEvent("JOURNAL_SAVED")
  }

  React.useEffect(() => {
    if (savedToast === null) return
    if (savedToast.reviewMessage !== undefined) return
    const delay = savedToast.phase === "enter" ? TOAST_READABLE_MS : TOAST_EXIT_MS
    const t = window.setTimeout(() => {
      setSavedToast(current => {
        if (current === null) return null
        return current.phase === "enter" ? { ...current, phase: "exit" } : null
      })
    }, delay)
    return () => window.clearTimeout(t)
  }, [savedToast])
  React.useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current
    if (scrollRegion === null) return
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
    if (!shouldResetTabView(v, tab, utilityView !== null || athleteRecordsOpen || overlayRef.current !== null)) return
    runViewTransition(tabMotion(v.tab, tab), () => {
      dismissOracle()
      oracleInputRef.current = null
      setAthleteRecordsOpen(false)
      setUtilityView(null)
      setAnalysisContext(tab === "trends" ? analysis : undefined)
      calendarOriginalReturn.current = null
      setV(tab === "journal" && lastJournalView.current?.owner === activeLocalAccount() ? lastJournalView.current.view : viewForTab(tab))
    })
  }
  const goTrendsFromReceipt = () => {
    const context = savedToast ? analysisNavigationForReceipt(savedToast.receipt ?? { kind: "generic" }) : null
    runViewTransition(tabMotion(v.tab, "trends"), () => {
      dismissOracle()
      setSavedToast(null)
      setAthleteRecordsOpen(false)
      setUtilityView(null)
      setAnalysisContext(context ?? undefined)
      setV(viewForTab("trends"))
    })
  }
  const openDecorationStudio = (date?: string) => runViewTransition("push", () => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    decorationReturn.current = { owner: activeLocalAccount(), view: v, utility: utilityView, scroll: scrollRegionRef.current?.scrollTop ?? 0, focusLabel: active?.getAttribute("aria-label") ?? null, focusText: active?.textContent?.trim() ?? null }
    setDecorationInitialDate(date)
    setUtilityOrigin(utilityView === "more" ? "more" : "home")
    setUtilityView("rewards")
    setV({ ...viewForTab("home"), detailDate: null })
    setSavedToast(null)
  })
  const closeDecorationStudio = () => runViewTransition("pop", () => {
    const origin = decorationReturn.current
    decorationReturn.current = null; setDecorationInitialDate(undefined)
    if (!origin || origin.owner !== activeLocalAccount()) { setUtilityView(utilityOrigin === "home" ? null : "more"); return }
    setV(origin.view); setUtilityView(origin.utility)
    window.requestAnimationFrame(() => {
      if (origin.owner !== activeLocalAccount()) return
      if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = origin.scroll
      if (origin.focusLabel) scrollRegionRef.current?.querySelector<HTMLElement>(`[aria-label=${JSON.stringify(origin.focusLabel)}]`)?.focus({ preventScroll: true })
      else if (origin.focusText) [...(scrollRegionRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(button => button.textContent?.trim() === origin.focusText)?.focus({ preventScroll: true })
    })
  })
  const dismissOracle = () => {
    // Leaving the exploration invalidates its older history entries too.
    // Otherwise Back could reopen a sample over a different destination tab.
    overlayHistoryOwnerRef.current = `shell-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (overlayRef.current?.kind !== "oracle" && overlayRef.current?.kind !== "record-reading" && overlayRef.current?.kind !== "running-profile") return
    const currentState = window.history.state
    if (typeof currentState === "object" && currentState !== null) {
      const { [OVERLAY_HISTORY_KEY]: _marker, ...rest } = currentState as Record<string, unknown>
      window.history.replaceState(rest, "", window.location.href)
    }
    overlayRef.current = null
    setOverlay(null)
    if (scrollRegionRef.current !== null) scrollRegionRef.current.scrollTop = 0
  }
  const openOracle = (topic: OracleTopicId, mode?: "example" | "personal") => runDraftSafeNavigation(() => openOverlay({ kind: "oracle", topic, ...(mode ? { mode } : {}) }))
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
    oracleInputRef.current = null
    if (!intent || intent.owner !== activeLocalAccount()) { setV(INITIAL_VIEW_STATE); return }
    setV(intent.view)
    openOverlay({ kind: "oracle", topic: intent.topic, mode: intent.mode, scrollTop: intent.scrollTop })
  })
  const openOraclePersonal = (action: "records" | "journal" | "trends" | "plan" | "log", section?: AnalysisSection, metric?: "DISTANCE_KM" | "RPE") => {
    runViewTransition("push", () => {
      const topic = overlayRef.current?.kind === "oracle" ? overlayRef.current.topic : null
      oracleInputRef.current = topic && (action === "records" || action === "log" || action === "plan")
        ? { topic, owner: activeLocalAccount(), inputKind: action, mode: overlayRef.current?.kind === "oracle" ? overlayRef.current.mode ?? "personal" : "personal", scrollTop: scrollRegionRef.current?.scrollTop ?? 0, view: v } : null
      if (action === "records") {
        dismissOracle()
        setUtilityView(null)
        setV(viewForTab("plan"))
        setAthleteRecordsOpen(true)
      } else {
        dismissOracle()
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
  const oracleHistory = usePlanEvidenceHistory(oracleUsesPlan && overlay?.mode !== "example")
  const athleteRecords = useAthleteRecordsSnapshot()
  const oracleResult = overlay?.kind === "oracle" ? buildOraclePersonalResult({
    topicId: overlay.topic, entries: loadEntries(), planState: loadPlanBetaState(),
    athleteRecords: athleteRecords.records, today: todayISO(), planHistory: oracleHistory.history,
  }) : undefined

  const accountEnabled = accountFeatureEnabled()
  const screenKey = [
    v.tab,
    v.entryType,
    v.detailDate ?? "",
    v.importOpen ? "import" : "",
    v.restoreOpen ? "restore" : "",
    v.accountOpen ? "account" : "",
    utilityView ?? "",
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
    athleteRecordsOpen,
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
    setAthleteRecordsOpen(point.athleteRecordsOpen)
  }
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
    importReturnRef.current = captureReturnPoint()
    setUtilityView(null)
    setAthleteRecordsOpen(false)
    setV(s => ({ ...s, tab: "log", accountOpen: false, restoreOpen: false, importOpen: true }))
  })
  const closeImport = () => runViewTransition("pop", () => {
    const point = importReturnRef.current
    importReturnRef.current = null
    restoreReturnPoint(point)
  })

  const detailScreen = (onBack: () => void, withReader = false) => {
    const common = {
      date: v.detailDate ?? "",
      initialEntryId: v.detailEntryId,
      onBack,
      onAddEntry: (date: string) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, date))),
      onEditEntry: (entry: JournalEntry) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, entry.date, entry))),
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
        onOpenHome={goHome}
      />
    )
  } else if (v.tab === "home" && v.accountOpen && accountEnabled) {
    screen = (
      <DeferredMobileScreens.Account
        loungeRequested={loungeEntryIntent().requested}
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
        onBack={() => runViewTransition("pop", () => setUtilityView(null))}
        onOpenMinji={() => runViewTransition("push", () => { setUtilityOrigin("more"); setUtilityView("minji") })}
        onOpenGuide={() => runViewTransition("push", () => { setUtilityOrigin("more"); setUtilityView("guide") })}
        onOpenContent={() => runViewTransition("push", () => { setUtilityOrigin("more"); setUtilityView("content") })}
        onOpenRewards={() => openDecorationStudio()}
        onOpenFeedback={() => openOverlay({ kind: "feedback" })}
        onOpenAccount={accountEnabled ? () => runViewTransition("push", () => setV(s => ({ ...s, accountOpen: true }))) : undefined}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home" && utilityView === "content") {
    screen = <DeferredMobileScreens.TrainingContent onBack={() => runViewTransition("pop", () => setUtilityView(utilityOrigin === "home" ? null : "more"))} />
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
      onBack={() => runViewTransition("pop", () => setUtilityView(utilityOrigin === "home" ? null : "more"))}
      onWriteLog={() => runViewTransition("tab-forward", () => { setUtilityView(null); setV(viewForTab("log")) })}
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
          onWriteLog={(entryType) => runViewTransition("tab-forward", () => setV(s => ({ ...s, tab: "log", entryType: entryType ?? "choose" })))}
          onOpenDay={(date, entryId) => runViewTransition("push", () => {
            setHomeDetailOrigin("home")
            setV(s => ({ ...s, detailDate: date, detailEntryId: entryId }))
          })}
          onDecorateToday={() => openDecorationStudio()}
          onOpenArchive={() => {
            runViewTransition("tab-forward", () => setV({ ...viewForTab("journal"), journalMode: "CALENDAR" }))
          }}
          onOpenGuide={() => runViewTransition("push", () => { setUtilityOrigin("home"); setUtilityView("minji") })}
          onOpenPlan={() => goTab("plan")}
          onOpenTrends={() => goTab("trends")}
          onOpenOracle={openOracle}
          onOpenMore={() => runViewTransition("push", () => setUtilityView("more"))}
          onOpenAccount={accountEnabled ? () => runViewTransition("push", () => setV(s => ({ ...s, accountOpen: true }))) : undefined}
          onOpenContent={() => runViewTransition("push", () => { setUtilityOrigin("home"); setUtilityView("content") })}
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
        if (calendarOriginalReturn.current && window.history.state?.calendarOriginalPage === calendarOriginalReturn.current.token) window.history.back()
        else runViewTransition("pop", () => setV(s => ({ ...s, detailDate: null })))
      }, true)
      : (
        <DeferredMobileScreens.JournalArchive
          entries={calendarSnapshot.entries}
          readiness={calendarSnapshot.status}
          selection={selection}
          mode={v.journalMode}
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
          onOpenDay={(detailDate) => runViewTransition("push", () => {
            const token = `calendar-original-${Date.now()}`
            const { [READER_HISTORY_KEY]: reader, ...rest } = window.history.state ?? {}
            try {
              window.history[reader ? "replaceState" : "pushState"]({ ...rest, calendarOriginalPage: token }, "", window.location.href)
              calendarOriginalReturn.current = { token, owner: activeLocalAccount(), view: { ...v, detailDate: null } }
            } catch { /* In-app Back still returns to the archive. */ }
            setV(s => ({ ...s, detailDate, detailEntryId: undefined }))
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
        <DeferredMobileScreens.PlanProposalInbox />
        <DeferredMobileScreens.PlanBeta
          multiAdjustmentResolverV3={multiPlanRuntime?.multiAdjustmentResolverV3}
          readMultiAdjustedEvidenceV3={multiPlanRuntime?.readMultiAdjustedEvidenceV3}
          onManageRecords={() => runViewTransition("push", () => setAthleteRecordsOpen(true))}
          onWriteLog={(entryType) => runViewTransition("tab-backward", () => setV(viewForTab("log", entryType)))}
          onWritePlannedSessionLog={(draft) => runViewTransition("tab-backward", () => setV((state) => viewForPlannedSessionDraft(state, draft)))}
          returnToSession={v.returnToSession}
        />
      </>
    )
  } else if (v.tab === "log" && v.importOpen) {
    screen = (
      <DeferredMobileScreens.ImportActivities
        onBack={closeImport}
        onOpenLog={() => goTab("journal")}
        onOpenAnalysis={() => goTab("trends", { section: "files" })}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        targetDate={v.journalDraft?.date}
        initialEntry={v.journalDraft?.initialEntry}
        plannedSessionLink={v.journalDraft?.plannedSessionLink}
        onBack={oracleInputRef.current !== null ? returnFromOracleInput : v.entryType === "choose"
          ? v.journalDraft === undefined
            ? goHome
            : () => runViewTransition("pop", () => setV(viewForJournalReturn(v)))
          : v.journalDraft?.initialEntry !== undefined || v.journalDraft?.plannedSessionLink !== undefined
            ? () => runViewTransition("pop", () => setV(viewForJournalReturn(v)))
            : () => runViewTransition("pop", () => setV(s => ({ ...s, entryType: "choose" })))}
        onOpenImport={openImport}
        onContinueDetailed={(entry) => runViewTransition("replace", () => setV((state) => viewForJournalDraft(state, entry.date, entry)))}
        onDone={(picked, savedEntry, reviewMessage, storageMessage) => {
          if (v.entryType === "choose") {
            runViewTransition("push", () => setV(s => ({ ...s, entryType: picked })))
          } else if (savedEntry !== undefined) {
            goHomeAfterSave(savedEntry, reviewMessage, v.journalDraft?.date, storageMessage)
          }
        }}
      />
    )
  } else if (v.tab === "trends") {
    screen = (
      <DeferredMobileScreens.Trends
        key={`${analysisContext?.section ?? "summary"}-${analysisContext?.metric ?? "default"}-${analysisContext?.savedDate ?? ""}`}
        initialContext={analysisContext}
        onBack={goHome}
        onWriteLog={() => goTab("log")}
        onOpenPlan={() => goTab("plan")}
        onOpenOracle={openOracle}
        onOpenRecordReading={() => openOverlay({ kind: "record-reading", stage: "own-event" })}
        onOpenRunningProfile={() => openOverlay({ kind: "running-profile", stage: "overview" })}
      />
    )
  }

  return (
    <MultiPlanEvidenceContext.Provider value={multiPlanRuntime?.readMultiAdjustedEvidenceV3}>
    <AppOverlayNavigationProvider
      openTrainingTerm={(term) => openOverlay({ kind: "term", term })}
      openFeedback={() => openOverlay({ kind: "feedback" })}
    >
    <AppShellFrame
      scrollRegionRef={scrollRegionRef}
      savedToast={savedToast}
      tab={tabForChrome(v)}
      onDismissToast={() => setSavedToast(null)}
      onOpenTrends={goTrendsFromReceipt}
      onDecorateSaved={() => { const date = savedToast?.receipt.savedDate; if (date && loadEntries().some(entry => entry.date === date)) openDecorationStudio(date) }}
      onOpenBackup={() => {
        setSavedToast(null)
        openRestore()
      }}
      onTab={goTab}
      hideTabBar={overlay !== null && overlay.kind !== "oracle"}
    >
      <React.Suspense fallback={<AppLoadingState />}>
        <div
          key={`${screenKey}:account-scope-${accountScopeRevision}`}
          className="app-flow-stage"
          data-motion={currentScreenMotion}
          hidden={overlay !== null}
        >
          <ErrorBoundary key={`${screenKey}:account-scope-${accountScopeRevision}`} region recoveryTab={tabForChrome(v)}>
            {screen}
          </ErrorBoundary>
        </div>
        <ErrorBoundary key={`overlay-${overlay?.kind ?? "none"}-${accountScopeRevision}`} region onExit={closeOverlay} recoveryTab={tabForChrome(v)}>
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
                onNavigate={destination => runDraftSafeNavigation(() => {
                  if (destination === "RECORDS") openOraclePersonal("records")
                  else if (destination === "JOURNAL") openOraclePersonal("journal")
                  else if (destination === "METHODS") { dismissOracle(); setUtilityOrigin("home"); setUtilityView("content") }
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
              <p role="status">{athleteRecords.message}</p>
            </> :
            <DeferredMobileScreens.OracleExplore
              key={`${overlay.topic}-${overlay.mode ?? "auto"}-${accountScopeRevision}`}
              topicId={overlay.topic}
              personalResult={oracleResult}
              personalResultUnavailable={oracleUsesPlan && !oracleHistory.journalReadComplete}
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
        </ErrorBoundary>
      </React.Suspense>
    </AppShellFrame>
    </AppOverlayNavigationProvider>
    </MultiPlanEvidenceContext.Provider>
  )
}

export { useIsMobileShell } from "./components/AppShellFrame"
export { SavedToast } from "./components/AppChrome"
