import React from "react"
import { SavedToast, TabBar } from "./AppChrome"
import type { AppTab, ToastPhase } from "./AppChrome"
import type { SavedFactReceipt } from "../domain/save-receipt"

export type ShellToastState = {
  readonly count: number
  readonly phase: ToastPhase
  readonly receipt: SavedFactReceipt
  readonly reviewMessage?: string
}

export function AppShellFrame({
  children,
  scrollRegionRef,
  savedToast,
  tab,
  onDismissToast,
  onOpenTrends,
  onTab,
}: {
  readonly children: React.ReactNode
  readonly scrollRegionRef: React.RefObject<HTMLElement>
  readonly savedToast: ShellToastState | null
  readonly tab: AppTab
  readonly onDismissToast: () => void
  readonly onOpenTrends: () => void
  readonly onTab: (tab: AppTab) => void
}) {
  return (
    <div className="app-shell" style={{
      height: "100dvh", minHeight: 0, background: "var(--bg)",
      display: "flex", flexDirection: "column",
      maxWidth: "var(--app-shell-max-width)", margin: "0 auto",
    }}>
      <main ref={scrollRegionRef} className="app-scroll-region">
        {children}
      </main>
      {savedToast !== null && (
        <SavedToast
          count={savedToast.count}
          phase={savedToast.phase}
          receipt={savedToast.receipt}
          reviewMessage={savedToast.reviewMessage}
          onDismiss={onDismissToast}
          onOpenTrends={onOpenTrends}
        />
      )}
      <TabBar tab={tab} onTab={onTab} />
    </div>
  )
}

export function useIsMobileShell(): boolean {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  return !(params?.has("workspace") ?? false)
}
