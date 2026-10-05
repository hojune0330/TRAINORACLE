import React from "react"
import type { TermId } from "../domain/glossary"
import type { PaceToolRequest } from "../domain/pace-tools"

type AppOverlayNavigation = {
  readonly openTrainingTerm: (term: TermId) => void
  readonly openFeedback: () => void
  readonly openPaceCalculator?: (request?: PaceToolRequest) => void
}

const AppOverlayNavigationContext = React.createContext<AppOverlayNavigation | null>(null)

export function AppOverlayNavigationProvider({
  children,
  openTrainingTerm,
  openFeedback,
  openPaceCalculator,
}: {
  readonly children: React.ReactNode
  readonly openTrainingTerm: (term: TermId) => void
  readonly openFeedback: () => void
  readonly openPaceCalculator?: (request?: PaceToolRequest) => void
}) {
  const value = React.useMemo(() => ({ openTrainingTerm, openFeedback, openPaceCalculator }), [openFeedback, openTrainingTerm, openPaceCalculator])
  return <AppOverlayNavigationContext.Provider value={value}>{children}</AppOverlayNavigationContext.Provider>
}

export function useAppOverlayNavigation(): AppOverlayNavigation | null {
  return React.useContext(AppOverlayNavigationContext)
}
