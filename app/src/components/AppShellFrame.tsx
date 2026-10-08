import React from "react"
import { SavedToast, TabBar } from "./AppChrome"
import type { AppTab, ToastPhase } from "./AppChrome"
import type { SavedFactReceipt } from "../domain/save-receipt"
import { ShellToastHostProvider, ShellToastOutlet } from "./ShellToastHost"
import { JournalSaveResult } from "./JournalSaveResult"

export type ShellToastState = {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt: SavedFactReceipt
  readonly reviewMessage?: string
  readonly storageMessage?: string
  readonly storageStatus?: "CONFIRMED" | "PENDING" | "CONFLICT"
  readonly rewardMessage?: string
  readonly rewardRetry?: boolean
  readonly rewardLoading?: boolean
  /** A flow such as QuickSession already showed its own actionable completion. */
  readonly completionAlreadyShown?: boolean
}

export function AppShellFrame({
  children,
  scrollRegionRef,
  savedToast,
  tab,
  onDismissToast,
  onOpenTrends,
  onOpenBackup,
  onDecorateSaved,
  onOpenSaved,
  onRetryReward,
  onTab,
  onStartRecording,
  hideTabBar = false,
  wideTask = false,
}: {
  readonly children: React.ReactNode
  readonly scrollRegionRef: React.RefObject<HTMLElement>
  readonly savedToast: ShellToastState | null
  readonly tab: AppTab
  readonly onDismissToast: () => void
  readonly onOpenTrends: () => void
  readonly onOpenBackup?: () => void
  readonly onDecorateSaved?: () => void
  readonly onOpenSaved?: () => void
  readonly onRetryReward?: () => void
  readonly onTab: (tab: AppTab) => void
  readonly onStartRecording?: () => void
  readonly hideTabBar?: boolean
  readonly wideTask?: boolean
}) {
  const showResult = savedToast?.receipt.savedDate !== undefined && !savedToast.completionAlreadyShown
  const previousResult = React.useRef(showResult)
  React.useLayoutEffect(() => {
    const returning = previousResult.current && !showResult
    previousResult.current = showResult
    if (!returning) return
    // The saved form has already left. Restore focus to the live destination,
    // not a detached Save button or a text input that would open the keyboard.
    const heading = [...(scrollRegionRef.current?.querySelectorAll<HTMLElement>("h1, h2") ?? [])]
      .find(node => node.closest("[hidden]") === null)
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  }, [showResult, scrollRegionRef])
  return (
    <ShellToastHostProvider>
      <div className={`app-shell${wideTask || showResult ? " app-shell--task" : ""}`} style={{
        height: "100dvh", minHeight: 0, background: "var(--bg)",
        display: "flex", flexDirection: "column",
        maxWidth: "var(--app-shell-max-width)", margin: "0 auto",
      }}>
        <main ref={scrollRegionRef} className="app-scroll-region">
          <div hidden={showResult} style={showResult ? undefined : { display: "contents" }}>{children}</div>
          {showResult && savedToast && <JournalSaveResult result={savedToast} onClose={onDismissToast}
            onOpenSaved={onOpenSaved} onDecorateSaved={onDecorateSaved}
            onOpenTrends={onOpenTrends} onRetryReward={onRetryReward} />}
        </main>
        {savedToast !== null && !showResult && (
          <ShellToastOutlet>
            <SavedToast
              count={savedToast.count}
              phase={savedToast.phase}
              receipt={savedToast.receipt}
              reviewMessage={savedToast.reviewMessage}
              storageMessage={savedToast.storageMessage}
              rewardMessage={savedToast.rewardMessage}
              rewardRetry={savedToast.rewardRetry}
              rewardLoading={savedToast.rewardLoading}
              onRetryReward={onRetryReward}
              onDismiss={onDismissToast}
              onOpenTrends={onOpenTrends}
              onOpenBackup={onOpenBackup}
              onDecorateSaved={onDecorateSaved}
              onOpenSaved={onOpenSaved}
            />
          </ShellToastOutlet>
        )}
        {!hideTabBar && !showResult && <TabBar tab={tab} onTab={onTab} onStartRecording={onStartRecording ?? (() => onTab("log"))} />}
      </div>
    </ShellToastHostProvider>
  )
}

export function useIsMobileShell(): boolean {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  return !(params?.has("workspace") ?? false)
}
