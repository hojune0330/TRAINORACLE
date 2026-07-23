import React from "react"
import { SavedToast, TabBar } from "./components/AppChrome"
import type { AppTab, ToastPhase } from "./components/AppChrome"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import type { EntryType } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import { Trends } from "./screens/Trends"
import { Guide } from "./screens/Guide"
import { localOnlyCount } from "./domain/journal-store"
import type { JournalEntry } from "./domain/journal-store"
import { createSavedFactReceipt } from "./domain/save-receipt"
import type { SavedFactReceipt } from "./domain/save-receipt"
import { dismissFirstVisit, hasDismissedFirstVisit } from "./domain/onboarding-state"

interface ViewState {
  tab: AppTab
  /** log 탭 내부 단계 */
  entryType: EntryType
  /** home에서 연 일지 상세 (날짜) — null이면 홈 목록 */
  detailDate: string | null
}

const INITIAL: ViewState = { tab: "home", entryType: "choose", detailDate: null }
const TOAST_READABLE_MS = 4000
const TOAST_EXIT_MS = 150

type SavedToastState = {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt: SavedFactReceipt
  readonly reviewMessage?: string
}

export function AppShell() {
  const [v, setV] = React.useState<ViewState>(INITIAL)
  const [savedToast, setSavedToast] = React.useState<SavedToastState | null>(null)
  const [firstVisitActive, setFirstVisitActive] = React.useState(
    () => localOnlyCount() === 0 && !hasDismissedFirstVisit(),
  )

  const goHome = () => setV(INITIAL)
  const goHomeAfterSave = (savedEntry: JournalEntry, reviewMessage?: string) => {
    const receipt = createSavedFactReceipt(savedEntry)
    setV(INITIAL)
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
  const goTab = (tab: AppTab) =>
    setV({ tab, entryType: "choose", detailDate: null })
  const goTrendsFromReceipt = () => {
    setSavedToast(null)
    goTab("trends")
  }

  let screen: React.ReactNode
  if (v.tab === "home") {
    screen = v.detailDate ? (
      <LogDetail date={v.detailDate} onBack={() => setV(s => ({ ...s, detailDate: null }))} />
    ) : (
      <Home
        onWriteLog={(entryType) => setV(s => ({ ...s, tab: "log", entryType: entryType ?? "choose" }))}
        onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
        onOpenGuide={() => setV(s => ({ ...s, tab: "guide" }))}
        firstVisitActive={firstVisitActive}
        onDismissFirstVisit={() => {
          dismissFirstVisit()
          setFirstVisitActive(false)
        }}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        onBack={v.entryType === "choose" ? goHome : () => setV(s => ({ ...s, entryType: "choose" }))}
        onDone={(picked, savedEntry, reviewMessage) => {
          if (v.entryType === "choose") {
            setV(s => ({ ...s, entryType: picked }))
          } else if (savedEntry !== undefined) {
            goHomeAfterSave(savedEntry, reviewMessage)
          }
        }}
      />
    )
  } else if (v.tab === "trends") {
    screen = <Trends onBack={goHome} />
  } else {
    screen = <Guide onWriteLog={() => setV({ tab: "log", entryType: "choose", detailDate: null })} />
  }

  return (
    <div className="app-shell" style={{
      height: "100dvh", minHeight: 0, background: "var(--bg)",
      display: "flex", flexDirection: "column",
      maxWidth: "var(--app-shell-max-width)", margin: "0 auto",
    }}>
      <main className="app-scroll-region">
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
