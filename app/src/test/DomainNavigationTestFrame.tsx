import React from "react"
import { render, type RenderOptions } from "@testing-library/react"
import { DomainDock, DomainNavigationProvider, type DomainDockState } from "../components/DomainNavigation"

const noop = () => undefined
/** Exercise screen navigation through the same single-owner contract as AppShell. */
export function DomainNavigationTestFrame({ children, onRecord = noop, onExit = noop }: { children: React.ReactNode; onRecord?: () => void; onExit?: () => void }) {
  const [dock, setDock] = React.useState<{ token: symbol; state: DomainDockState } | null>(null)
  const publish = React.useCallback((token: symbol, state: DomainDockState | null) => {
    setDock(current => state ? { token, state } : current?.token === token ? null : current)
  }, [])
  return <DomainNavigationProvider publish={publish} onRecord={onRecord}>
    {children}{dock && !dock.state.hidden && <DomainDock state={dock.state} hasOrigin onExit={onExit} />}
  </DomainNavigationProvider>
}
export function renderWithDomainNavigation(ui: React.ReactNode, options?: RenderOptions) {
  const onBack = React.isValidElement<{ onBack?: () => void }>(ui) ? ui.props.onBack : undefined
  return render(ui, { wrapper: ({ children }) => <DomainNavigationTestFrame onExit={onBack}>{children}</DomainNavigationTestFrame>, ...options })
}
