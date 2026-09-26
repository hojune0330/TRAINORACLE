import React from "react"
import { runDraftSafeNavigation } from "./domain/unsaved-draft-navigation"
import type { AppTab } from "./components/AppChrome"
import { AppShellFrame } from "./components/AppShellFrame"
import type { ShellToastState } from "./components/AppShellFrame"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import { DeferredMobileScreens } from "./DeferredMobileScreens"
import { accountFeatureEnabled } from "./domain/account/config"
import { loadEntries, localOnlyCount, todayISO } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { awardJournalEntry, type EngagementAwardResult } from "./domain/engagement"
import { ACCOUNT_REWARD_EVENT, accountRewardsEnabled, accountRewardStatus, readAccountRewardSummary } from "./domain/account/account-reward-service"
import { requestJournalDecorationAutoOpen } from "./domain/journal-decoration-intent"
import { createSavedFactReceipt } from "./domain/save-receipt"
import { analysisNavigationForReceipt, type AnalysisNavigation, type AnalysisSection } from "./domain/analysis-navigation"
import { buildOraclePersonalResult } from "./domain/oracle-personal-result"
import { loadPlanBetaState } from "./domain/plan-beta-store"
import { loadAthleteRecords } from "./domain/athlete-records"
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

type AppOverlay =
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
  const [accountScopeRevision, setAccountScopeRevision] = React.useState(0)
  const [, refreshAccountJournals] = React.useReducer((revision: number) => revision + 1, 0)
  const [v, setV] = React.useState(() => {
    if (!accountFeatureEnabled() || typeof window === "undefined") return INITIAL_VIEW_STATE
    return new URLSearchParams(window.location.search).get("account") === "1"
      ? { ...INITIAL_VIEW_STATE, accountOpen: true }
      : INITIAL_VIEW_STATE
  })
  const [savedToast, setSavedToast] = React.useState<ShellToastState | null>(null)
  const [analysisContext, setAnalysisContext] = React.useState<AnalysisNavigation | undefined>()
  const oracleInputRef = React.useRef<{ topic: OracleTopicId; owner: string | null; inputKind: "log" | "records" | "plan"; mode: "example" | "personal"; scrollTop: number; view: ReturnType<typeof viewForTab> } | null>(null)
  const pendingReward = React.useRef<{ ownerId: string | null; date: string } | null>(null)
  const [athleteRecordsOpen, setAthleteRecordsOpen] = React.useState(false)
  const [homeDetailOrigin, setHomeDetailOrigin] = React.useState<"home" | "rewards">("home")
  const scrollRegionRef = React.useRef<HTMLElement>(null)
  const [utilityView, setUtilityView] = React.useState<"more" | "guide" | "minji" | "content" | "rewards" | null>(null)
  const [utilityOrigin, setUtilityOrigin] = React.useState<"home" | "more">("more")
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
    const method = overlayRef.current === null || addsTermHistory || addsOracleHistory ? "pushState" : "replaceState"
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
    const onPopState = (event: PopStateEvent) => {
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
        applyOverlay(null)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [applyOverlay])

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
    const scope = () => { pendingReward.current = null; oracleInputRef.current = null; setSavedToast(null); setAnalysisContext(undefined) }
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
      }
    }).catch(() => {
      if (mounted && !authEventSeen) {
        setAccountAuthState("FAILED")
        setActiveLocalAccount(null)
      }
    })
    const unsubscribeAuth = onAuthChange((user) => {
      authEventSeen = true
      setActiveLocalAccount(user?.id ?? null)
      setAccountAuthState(user ? "RESOLVING" : "GUEST")
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
      window.history.replaceState(null, "", url)
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
      setV(viewForTab(tab))
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
  const dismissOracle = () => {
    // Leaving the exploration invalidates its older history entries too.
    // Otherwise Back could reopen a sample over a different destination tab.
    overlayHistoryOwnerRef.current = `shell-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (overlayRef.current?.kind !== "oracle") return
    const currentState = window.history.state
    if (typeof currentState === "object" && currentState !== null) {
      const { [OVERLAY_HISTORY_KEY]: _marker, ...rest } = currentState as Record<string, unknown>
      window.history.replaceState(rest, "", window.location.href)
    }
    overlayRef.current = null
    setOverlay(null)
    if (scrollRegionRef.current !== null) scrollRegionRef.current.scrollTop = 0
  }
  const openOracle = (topic: OracleTopicId) => runDraftSafeNavigation(() => openOverlay({ kind: "oracle", topic }))
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
  const oracleResult = overlay?.kind === "oracle" ? buildOraclePersonalResult({
    topicId: overlay.topic, entries: loadEntries(), planState: loadPlanBetaState(),
    athleteRecords: loadAthleteRecords(), today: todayISO(),
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
      onBack,
      onAddEntry: (date: string) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, date))),
      onEditEntry: (entry: JournalEntry) => runViewTransition("push", () => setV(s => viewForJournalDraft(s, entry.date, entry))),
    }
    return withReader ? (
      <DeferredMobileScreens.JournalDayReader
        {...common}
        backDestination={v.tab === "home" ? homeDetailOrigin : "journal"}
        entries={loadEntries()}
        onDateChange={(detailDate) => runViewTransition("replace", () => setV(s => ({ ...s, detailDate })))}
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
        onBack={() => runViewTransition("pop", () => setV(s => ({ ...s, accountOpen: false })))}
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
        onOpenRewards={() => runViewTransition("push", () => { setUtilityOrigin("more"); setUtilityView("rewards") })}
        onOpenFeedback={() => openOverlay({ kind: "feedback" })}
        onOpenAccount={accountEnabled ? () => runViewTransition("push", () => setV(s => ({ ...s, accountOpen: true }))) : undefined}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home" && utilityView === "content") {
    screen = <DeferredMobileScreens.TrainingContent onBack={() => runViewTransition("pop", () => setUtilityView(utilityOrigin === "home" ? null : "more"))} />
  } else if (v.tab === "home" && utilityView === "rewards") {
    screen = <DeferredMobileScreens.JournalRewards
      onBack={() => runViewTransition("pop", () => setUtilityView(utilityOrigin === "home" ? null : "more"))}
      onOpenMore={() => runViewTransition("push", () => { setUtilityOrigin("home"); setUtilityView("more") })}
      onDecorateToday={() => {
        const date = todayISO()
        requestJournalDecorationAutoOpen(date)
        runViewTransition("push", () => {
          setHomeDetailOrigin("rewards")
          setUtilityView(null)
          setV(s => ({ ...s, detailDate: date }))
        })
      }}
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
          onOpenDay={(date) => runViewTransition("push", () => {
            setHomeDetailOrigin("home")
            setV(s => ({ ...s, detailDate: date }))
          })}
          onDecorateToday={() => {
            /* 홈 꾸미기 카드: 오늘 일지 상세로 이동하며 편집기 자동 열기를 예약한다. */
            const date = todayISO()
            requestJournalDecorationAutoOpen(date)
            runViewTransition("push", () => setV(s => ({ ...s, detailDate: date })))
          }}
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
          onOpenRewards={() => runViewTransition("push", () => { setUtilityOrigin("home"); setUtilityView("rewards") })}
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
      ? detailScreen(() => runViewTransition("pop", () => setV(s => ({ ...s, detailDate: null }))), true)
      : (
        <DeferredMobileScreens.JournalArchive
          entries={loadEntries()}
          selection={selection}
          mode={v.journalMode}
          cycleAnchor={v.cycleAnchor}
          cycleIndex={v.cycleIndex}
          onModeChange={(journalMode) => setV(s => ({ ...s, journalMode }))}
          onCycleAnchorChange={(cycleAnchor) => setV(s => ({ ...s, cycleAnchor, cycleIndex: 0 }))}
          onCycleIndexChange={(cycleIndex) => setV(s => ({ ...s, cycleIndex }))}
          onSelectionChange={(archiveSelection) => setV(s => ({ ...s, archiveSelection }))}
          onOpenDay={(detailDate) => runViewTransition("push", () => setV(s => ({ ...s, detailDate })))}
          onBack={goHome}
          onWriteLog={() => goTab("log")}
        />
      )
  } else if (v.tab === "plan") {
    screen = athleteRecordsOpen ? (
      <DeferredMobileScreens.AthleteRecords
        onBack={returnToOracleAfterRecord}
        onSaved={oracleInputRef.current ? returnToOracleAfterRecord : undefined}
        backLabel={oracleInputRef.current ? "분석으로" : "계획으로"}
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
          {screen}
        </div>
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
        {overlay?.kind === "oracle" && (
          <div className="app-flow-stage" data-motion="push" data-overlay="oracle">
            <DeferredMobileScreens.OracleExplore
              key={`${overlay.topic}-${overlay.mode ?? "auto"}-${accountScopeRevision}`}
              topicId={overlay.topic}
              personalResult={oracleResult}
              initialMode={overlay.mode}
              onModeChange={changeOracleMode}
              onBack={closeOverlay}
              onSelectTopic={openOracle}
              onPersonalAction={openOraclePersonal}
            />
          </div>
        )}
      </React.Suspense>
    </AppShellFrame>
    </AppOverlayNavigationProvider>
    </MultiPlanEvidenceContext.Provider>
  )
}

export { useIsMobileShell } from "./components/AppShellFrame"
export { SavedToast } from "./components/AppChrome"
