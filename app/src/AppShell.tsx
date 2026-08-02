import React from "react"
import type { AppTab } from "./components/AppChrome"
import { AppShellFrame } from "./components/AppShellFrame"
import type { ShellToastState } from "./components/AppShellFrame"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import { JournalArchive } from "./screens/JournalArchive"
import { Trends } from "./screens/Trends"
import { Guide } from "./screens/Guide"
import { PlanBeta } from "./screens/PlanBeta"
import { PlanProposalInbox } from "./screens/plan-beta/PlanProposalInbox"
import { AthleteRecords } from "./screens/AthleteRecords"
import { Account } from "./screens/Account"
import { ImportActivities } from "./screens/ImportActivities"
import { RestoreBackup } from "./screens/RestoreBackup"
import { accountFeatureEnabled } from "./domain/account/config"
import { loadEntries, localOnlyCount } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { createSavedFactReceipt } from "./domain/save-receipt"
import { dismissFirstVisit, hasDismissedFirstVisit } from "./domain/onboarding-state"
import { trackProductEvent } from "./domain/account/product-analytics-service"
import { INITIAL_VIEW_STATE, viewForTab } from "./domain/app-shell-state"
const TOAST_READABLE_MS = 4000
const TOAST_EXIT_MS = 150

export function AppShell() {
  const [v, setV] = React.useState(INITIAL_VIEW_STATE)
  const [savedToast, setSavedToast] = React.useState<ShellToastState | null>(null)
  const [athleteRecordsOpen, setAthleteRecordsOpen] = React.useState(false)
  const scrollRegionRef = React.useRef<HTMLElement>(null)
  const [firstVisitActive, setFirstVisitActive] = React.useState(
    () => localOnlyCount() === 0 && !hasDismissedFirstVisit(),
  )

  React.useEffect(() => {
    void trackProductEvent("APP_OPENED")
  }, [])

  const goHome = () => {
    setAthleteRecordsOpen(false)
    setV(INITIAL_VIEW_STATE)
  }
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string, detailDate?: string) => {
    const receipt = createSavedFactReceipt(savedEntry)
    setV(detailDate === undefined
      ? INITIAL_VIEW_STATE
      : { ...INITIAL_VIEW_STATE, detailDate, archiveSelection: v.archiveSelection })
    dismissFirstVisit()
    setFirstVisitActive(false)
    setSavedToast({ count: localOnlyCount(), phase: "enter", receipt, reviewMessage })
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
  ])
  const goTab = (tab: AppTab) => {
    setAthleteRecordsOpen(false)
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

  const detailScreen = (onBack: () => void) => (
    <LogDetail
      date={v.detailDate ?? ""}
      onBack={onBack}
      onAddEntry={(date) => setV(s => ({
        ...s,
        tab: "log",
        entryType: "choose",
        detailDate: date,
        journalDraft: { date },
      }))}
      onEditEntry={(entry) => setV(s => ({
        ...s,
        tab: "log",
        entryType: entry.kind,
        detailDate: entry.date,
        journalDraft: { date: entry.date, initialEntry: entry },
      }))}
    />
  )

  let screen: React.ReactNode
  if (v.tab === "home" && v.restoreOpen) {
    screen = (
      <RestoreBackup
        onBack={() => setV(s => ({ ...s, restoreOpen: false }))}
        onOpenHome={goHome}
      />
    )
  } else if (v.tab === "home" && v.accountOpen && accountEnabled) {
    screen = (
      <Account
        onBack={() => setV(s => ({ ...s, accountOpen: false }))}
        onOpenImport={() => setV(s => ({ ...s, tab: "log", accountOpen: false, importOpen: true }))}
        onOpenRestore={openRestore}
      />
    )
  } else if (v.tab === "home") {
    if (v.archiveSelection !== null) {
      screen = v.detailDate !== null
        ? detailScreen(() => setV(s => ({ ...s, detailDate: null })))
        : (
          <JournalArchive
            entries={loadEntries()}
            selection={v.archiveSelection}
            onSelectionChange={(archiveSelection) => setV(s => ({ ...s, archiveSelection }))}
            onOpenDay={(detailDate) => setV(s => ({ ...s, detailDate }))}
            onBack={goHome}
          />
        )
    } else {
      screen = v.detailDate !== null
        ? detailScreen(() => setV(s => ({ ...s, detailDate: null })))
        : (
          <Home
            onWriteLog={(entryType) => setV(s => ({ ...s, tab: "log", entryType: entryType ?? "choose" }))}
            onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
            onOpenArchive={() => setV(s => ({
              ...s,
              detailDate: null,
              archiveSelection: { selectedMonth: null, selectedWeekStart: null },
            }))}
            onOpenGuide={() => setV(s => ({ ...s, tab: "guide" }))}
            onOpenPlan={() => setV(s => ({ ...s, tab: "plan" }))}
            onOpenAccount={accountEnabled ? () => setV(s => ({ ...s, accountOpen: true })) : undefined}
            onOpenRestore={openRestore}
            firstVisitActive={firstVisitActive}
            onDismissFirstVisit={() => {
              dismissFirstVisit()
              setFirstVisitActive(false)
            }}
          />
        )
    }
  } else if (v.tab === "plan") {
    screen = athleteRecordsOpen ? (
      <AthleteRecords onBack={() => setAthleteRecordsOpen(false)} />
    ) : (
      <>
        <PlanProposalInbox />
        <PlanBeta
          onManageRecords={() => setAthleteRecordsOpen(true)}
          onWriteLog={(entryType) => setV(viewForTab("log", entryType))}
        />
      </>
    )
  } else if (v.tab === "log" && v.importOpen) {
    screen = (
      <ImportActivities
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
            : () => setV(s => ({ ...s, tab: "home", entryType: "choose", detailDate: s.journalDraft?.date ?? null, journalDraft: undefined }))
          : v.journalDraft?.initialEntry !== undefined
            ? () => setV(s => ({ ...s, tab: "home", entryType: "choose", detailDate: s.journalDraft?.date ?? null, journalDraft: undefined }))
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
    screen = <Trends onBack={goHome} />
  } else {
    screen = <Guide onWriteLog={() => setV(viewForTab("log"))} />
  }

  return (
    <AppShellFrame
      scrollRegionRef={scrollRegionRef}
      savedToast={savedToast}
      tab={v.tab}
      onDismissToast={() => setSavedToast(null)}
      onOpenTrends={goTrendsFromReceipt}
      onTab={goTab}
    >
      {screen}
    </AppShellFrame>
  )
}

export { useIsMobileShell } from "./components/AppShellFrame"
export { SavedToast } from "./components/AppChrome"
