import React from "react"
import { SavedToast, TabBar } from "./components/AppChrome"
import type { AppTab, ToastPhase } from "./components/AppChrome"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import type { EntryType } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import { Trends } from "./screens/Trends"
import { Guide } from "./screens/Guide"
import { PlanBeta } from "./screens/PlanBeta"
import { Account } from "./screens/Account"
import { ImportActivities } from "./screens/ImportActivities"
import { RestoreBackup } from "./screens/RestoreBackup"
import { accountFeatureEnabled } from "./domain/account/config"
import { localOnlyCount, todayISO } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { createSavedFactReceipt } from "./domain/save-receipt"
import type { SavedFactReceipt } from "./domain/save-receipt"
import { dismissFirstVisit, hasDismissedFirstVisit } from "./domain/onboarding-state"
import { recordDailyVisit } from "./domain/engagement"

interface ViewState {
  tab: AppTab
  /** log 탭 내부 단계 */
  entryType: EntryType
  /** home에서 연 일지 상세 (날짜) — null이면 홈 목록 */
  detailDate: string | null
  /** 계정 화면 (home 탭 위 오버레이 성격) — feature flag ON일 때만 진입 가능 */
  accountOpen: boolean
  /** 기기 데이터 가져오기 화면 (기록 탭 위 오버레이) — 계정·승인 불필요 */
  importOpen: boolean
  /** 백업 되돌리기 화면 (home 탭 위 오버레이) — 계정·승인 불필요 */
  restoreOpen: boolean
  journalDraft?: {
    readonly date: string
    readonly initialEntry?: JournalEntry
  }
}

const INITIAL: ViewState = {
  tab: "home", entryType: "choose", detailDate: null,
  accountOpen: false, importOpen: false, restoreOpen: false,
}
const TOAST_READABLE_MS = 4000
const TOAST_EXIT_MS = 150

type SavedToastState = {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt: SavedFactReceipt
  readonly reviewMessage?: string
}

export function AppShell() {
  React.useState(() => recordDailyVisit(todayISO()))
  const [v, setV] = React.useState<ViewState>(INITIAL)
  const [savedToast, setSavedToast] = React.useState<SavedToastState | null>(null)
  const scrollRegionRef = React.useRef<HTMLElement | null>(null)
  const [firstVisitActive, setFirstVisitActive] = React.useState(
    () => localOnlyCount() === 0 && !hasDismissedFirstVisit(),
  )

  const goHome = () => setV(INITIAL)
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string, detailDate?: string) => {
    const receipt = createSavedFactReceipt(savedEntry)
    setV(detailDate === undefined ? INITIAL : { ...INITIAL, detailDate })
    dismissFirstVisit()
    setFirstVisitActive(false)
    setSavedToast({ count: localOnlyCount(), phase: "enter", receipt, reviewMessage })
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
  }, [v.tab, v.entryType, v.detailDate, v.journalDraft?.date, v.journalDraft?.initialEntry?.id])
  const goTab = (tab: AppTab) =>
    setV({ tab, entryType: "choose", detailDate: null, accountOpen: false, importOpen: false, restoreOpen: false })
  const goTrendsFromReceipt = () => {
    setSavedToast(null)
    goTab("trends")
  }

  const accountEnabled = accountFeatureEnabled()

  const openRestore = () => setV(s => ({ ...s, tab: "home", accountOpen: false, importOpen: false, restoreOpen: true }))

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
    screen = v.detailDate ? (
      <LogDetail
        date={v.detailDate}
        onBack={() => setV(s => ({ ...s, detailDate: null }))}
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
    ) : (
      <Home
        onWriteLog={(entryType) => setV(s => ({ ...s, tab: "log", entryType: entryType ?? "choose" }))}
        onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
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
  } else if (v.tab === "plan") {
    screen = (
      <PlanBeta
        onWriteLog={(entryType) => setV({
          tab: "log",
          entryType: entryType ?? "choose",
          detailDate: null,
          accountOpen: false,
          importOpen: false,
          restoreOpen: false,
        })}
      />
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
    screen = <Guide onWriteLog={() => setV({ tab: "log", entryType: "choose", detailDate: null, accountOpen: false, importOpen: false, restoreOpen: false })} />
  }

  return (
    <div className="app-shell" style={{
      height: "100dvh", minHeight: 0, background: "var(--bg)",
      display: "flex", flexDirection: "column",
      maxWidth: "var(--app-shell-max-width)", margin: "0 auto",
    }}>
      <main ref={scrollRegionRef} className="app-scroll-region">
        {screen}
      </main>
      {savedToast !== null && (
        <SavedToast
          count={savedToast.count}
          phase={savedToast.phase}
          receipt={savedToast.receipt}
          reviewMessage={savedToast.reviewMessage}
          onDismiss={() => setSavedToast(null)}
          onOpenTrends={goTrendsFromReceipt}
        />
      )}
      <TabBar tab={v.tab} onTab={goTab} />
    </div>
  )
}

export function useIsMobileShell(): boolean {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  return !(params?.has("workspace") ?? false)
}

export { SavedToast } from "./components/AppChrome"
