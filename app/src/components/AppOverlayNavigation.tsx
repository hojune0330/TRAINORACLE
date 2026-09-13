import React from "react"
import type { TermId } from "../domain/glossary"

type AppOverlayNavigation = {
  readonly openTrainingTerm: (term: TermId) => void
  readonly openFeedback: () => void
}

const AppOverlayNavigationContext = React.createContext<AppOverlayNavigation | null>(null)

export function AppOverlayNavigationProvider({
  children,
  openTrainingTerm,
  openFeedback,
}: {
  readonly children: React.ReactNode
  readonly openTrainingTerm: (term: TermId) => void
  readonly openFeedback: () => void
}) {
  const value = React.useMemo(() => ({ openTrainingTerm, openFeedback }), [openFeedback, openTrainingTerm])
  return <AppOverlayNavigationContext.Provider value={value}>{children}</AppOverlayNavigationContext.Provider>
}

export function useAppOverlayNavigation(): AppOverlayNavigation | null {
  return React.useContext(AppOverlayNavigationContext)
}
