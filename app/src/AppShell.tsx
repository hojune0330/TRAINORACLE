import React from "react"
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
import { createSavedFactReceipt } from "./domain/save-receipt"
import { trackProductEvent } from "./domain/account/product-analytics-service"
import { currentUser, onAuthChange } from "./domain/account/auth"
import {
  onLocalJournalScopeChange,
  setActiveLocalAccount,
} from "./domain/account/local-journal-ownership"
import {
  INITIAL_VIEW_STATE,
  shouldResetTabView,
  viewForJournalDraft,
  viewForJournalReturn,
  viewForTab,
} from "./domain/app-shell-state"

const JOURNAL_REWARD_MESSAGE = {
  AWARDED: "기록한 날 +4P가 반영됐어요.",
  ALREADY_AWARDED: "오늘의 다른 기록도 함께 모였어요. 이 날짜의 4P는 이미 반영돼 있어요.",
  INELIGIBLE: "기록은 저장됐어요. 포인트는 훈련·회복 항목을 남긴 날에만 쌓여요.",
  SAVE_FAILED: "기록은 저장됐지만 포인트는 이 기기에 반영하지 못했어요.",
} satisfies Record<EngagementAwardResult["kind"], string>

const TOAST_READABLE_MS = 4000
const TOAST_EXIT_MS = 150

export function AppShell() {
  const [accountScopeRevision, setAccountScopeRevision] = React.useState(0)
  const [v, setV] = React.useState(() => {
    if (!accountFeatureEnabled() || typeof window === "undefined") return INITIAL_VIEW_STATE
    return new URLSearchParams(window.location.search).get("account") === "1"
      ? { ...INITIAL_VIEW_STATE, accountOpen: true }
      : INITIAL_VIEW_STATE
  })
  const [savedToast, setSavedToast] = React.useState<ShellToastState | null>(null)
  const [athleteRecordsOpen, setAthleteRecordsOpen] = React.useState(false)
  const scrollRegionRef = React.useRef<HTMLElement>(null)
  const [utilityView, setUtilityView] = React.useState<"more" | "guide" | "minji" | null>(null)
  const [utilityOrigin, setUtilityOrigin] = React.useState<"home" | "more">("more")

  React.useEffect(() => {
    if (!accountFeatureEnabled()) {
      setActiveLocalAccount(null)
      return
    }
    let mounted = true
    let authEventSeen = false
    const refresh = () => setAccountScopeRevision((value) => value + 1)
    const unsubscribeScope = onLocalJournalScopeChange(refresh)
    void currentUser().then((user) => {
      if (mounted && !authEventSeen) setActiveLocalAccount(user?.id ?? null)
    })
    const unsubscribeAuth = onAuthChange((user) => {
      authEventSeen = true
      setActiveLocalAccount(user?.id ?? null)
    })
    return () => {
      mounted = false
      unsubscribeScope()
      unsubscribeAuth()
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
    setAthleteRecordsOpen(false)
    setUtilityView(null)
    setV(INITIAL_VIEW_STATE)
  }
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string, detailDate?: string) => {
    const receipt = createSavedFactReceipt(savedEntry)
    const reward = awardJournalEntry(savedEntry, todayISO())
    const rewardMessage = JOURNAL_REWARD_MESSAGE[reward.kind]
    setUtilityView(null)
    setV(detailDate === undefined ? INITIAL_VIEW_STATE : viewForJournalReturn(v))
    setSavedToast({ count: localOnlyCount(), phase: "enter", receipt, reviewMessage, rewardMessage })
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
  const goTab = (tab: AppTab) => {
    if (!shouldResetTabView(v, tab, utilityView !== null || athleteRecordsOpen)) return
    setAthleteRecordsOpen(false)
    setUtilityView(null)
    setV(viewForTab(tab))
  }
  const goTrendsFromReceipt = () => {
    setSavedToast(null)
    goTab("trends")
  }

  const accountEnabled = accountFeatureEnabled()

  const openRestore = () => setV(s => ({
    ...s,
    tab: "home",
    accountOpen: false,
    importOpen: false,
    restoreOpen: true,
    archiveSelection: null,
  }))

  const detailScreen = (onBack: () => void, withReader = false) => {
    const common = {
      date: v.detailDate ?? "",
      onBack,
      onAddEntry: (date: string) => setV(s => viewForJournalDraft(s, date)),
      onEditEntry: (entry: JournalEntry) => setV(s => viewForJournalDraft(s, entry.date, entry)),
    }
    return withReader ? (
      <DeferredMobileScreens.JournalDayReader
        {...common}
        entries={loadEntries()}
        onDateChange={(detailDate) => setV(s => ({ ...s, detailDate }))}
      />
    ) : <DeferredMobileScreens.LogDetail {...common} />
  }

  let screen: React.ReactNode
  if (v.tab === "home" && v.restoreOpen) {
    screen = (
      <DeferredMobileScreens.RestoreBackup
        onBack={() => setV(s => ({ ...s, restoreOpen: false }))}
        onOpenHome={goHome}
      />
    )
  } else if (v.tab === "home" && v.accountOpen && accountEnabled) {
    screen = (
      <DeferredMobileScreens.Account
        onBack={() => setV(s => ({ ...s, accountOpen: false }))}
        onOpenImport={() => setV(s => ({ ...s, tab: "log", accountOpen: false, importOpen: true }))}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home" && utilityView === "more") {
    screen = (
      <DeferredMobileScreens.More
        onBack={() => setUtilityView(null)}
        onOpenMinji={() => { setUtilityOrigin("more"); setUtilityView("minji") }}
        onOpenGuide={() => { setUtilityOrigin("more"); setUtilityView("guide") }}
        onOpenAccount={accountEnabled ? () => setV(s => ({ ...s, accountOpen: true })) : undefined}
        onOpenRestore={() => {
          setUtilityView(null)
          openRestore()
        }}
      />
    )
  } else if (v.tab === "home" && (utilityView === "guide" || utilityView === "minji")) {
    screen = <DeferredMobileScreens.Guide
      initialSection={utilityView}
      onBack={() => setUtilityView(utilityOrigin === "home" ? null : "more")}
      onWriteLog={() => { setUtilityView(null); setV(viewForTab("log")) }}
    />
  } else if (v.tab === "home") {
    screen = v.detailDate !== null
      ? detailScreen(() => setV(s => ({ ...s, detailDate: null })), true)
      : (
        <Home
          onWriteLog={(entryType) => setV(s => ({ ...s, tab: "log", entryType: entryType ?? "choose" }))}
          onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
          onOpenArchive={() => {
            setV({ ...viewForTab("journal"), journalMode: "CALENDAR" })
          }}
          onOpenGuide={() => { setUtilityOrigin("home"); setUtilityView("minji") }}
          onOpenPlan={() => setV(viewForTab("plan"))}
          onOpenTrends={() => setV(viewForTab("trends"))}
          onOpenMore={() => setUtilityView("more")}
          onOpenAccount={accountEnabled ? () => setV(s => ({ ...s, accountOpen: true })) : undefined}
        />
      )
  } else if (v.tab === "journal") {
    const selection = v.archiveSelection ?? { selectedMonth: null, selectedWeekStart: null }
    screen = v.detailDate !== null
      ? detailScreen(() => setV(s => ({ ...s, detailDate: null })), true)
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
          onOpenDay={(detailDate) => setV(s => ({ ...s, detailDate }))}
          onBack={goHome}
        />
      )
  } else if (v.tab === "plan") {
    screen = athleteRecordsOpen ? (
      <DeferredMobileScreens.AthleteRecords onBack={() => setAthleteRecordsOpen(false)} />
    ) : (
      <>
        <DeferredMobileScreens.PlanProposalInbox />
        <DeferredMobileScreens.PlanBeta
          onManageRecords={() => setAthleteRecordsOpen(true)}
          onWriteLog={(entryType) => setV(viewForTab("log", entryType))}
        />
      </>
    )
  } else if (v.tab === "log" && v.importOpen) {
    screen = (
      <DeferredMobileScreens.ImportActivities
        onBack={() => setV(s => ({ ...s, importOpen: false }))}
        onOpenLog={goHome}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        targetDate={v.journalDraft?.date}
        initialEntry={v.journalDraft?.initialEntry}
        onBack={v.entryType === "choose"
          ? v.journalDraft === undefined
            ? goHome
            : () => setV(viewForJournalReturn(v))
          : v.journalDraft?.initialEntry !== undefined
            ? () => setV(viewForJournalReturn(v))
            : () => setV(s => ({ ...s, entryType: "choose" }))}
        onOpenImport={() => setV(s => ({ ...s, importOpen: true }))}
        onDone={(picked, savedEntry, reviewMessage) => {
          if (v.entryType === "choose") {
            setV(s => ({ ...s, entryType: picked }))
          } else if (savedEntry !== undefined) {
            goHomeAfterSave(savedEntry, reviewMessage, v.journalDraft?.date)
          }
        }}
      />
    )
  } else if (v.tab === "trends") {
    screen = <DeferredMobileScreens.Trends onBack={goHome} />
  }

  return (
    <AppShellFrame
      scrollRegionRef={scrollRegionRef}
      savedToast={savedToast}
      tab={v.tab}
      onDismissToast={() => setSavedToast(null)}
      onOpenTrends={goTrendsFromReceipt}
      onOpenBackup={() => {
        setSavedToast(null)
        openRestore()
      }}
      onTab={goTab}
      hideTabBar={false}
    >
      <React.Suspense fallback={<p role="status">화면을 불러오는 중이에요.</p>}>
        <React.Fragment key={`account-scope-${accountScopeRevision}`}>
          {screen}
        </React.Fragment>
      </React.Suspense>
    </AppShellFrame>
  )
}

export { useIsMobileShell } from "./components/AppShellFrame"
export { SavedToast } from "./components/AppChrome"
