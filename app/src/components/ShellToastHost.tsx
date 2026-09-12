import React from "react"
import { createPortal } from "react-dom"

type ShellToastHostContextValue = {
  readonly host: HTMLElement | null
  readonly registerHost: (host: HTMLElement | null) => void
}

const ShellToastHostContext = React.createContext<ShellToastHostContextValue | null>(null)

export function ShellToastHostProvider({ children }: { readonly children: React.ReactNode }) {
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const registerHost = React.useCallback((nextHost: HTMLElement | null) => setHost(nextHost), [])
  const value = React.useMemo(() => ({ host, registerHost }), [host, registerHost])

  return <ShellToastHostContext.Provider value={value}>{children}</ShellToastHostContext.Provider>
}

export function ShellToastOutlet({ children }: { readonly children: React.ReactNode }) {
  const context = React.useContext(ShellToastHostContext)
  if (context === null) return <>{children}</>
  return context.host === null ? <>{children}</> : createPortal(children, context.host)
}

export function ShellToastHost({ active }: { readonly active: boolean }) {
  const registerHost = React.useContext(ShellToastHostContext)?.registerHost
  const hostRef = React.useCallback((node: HTMLDivElement | null) => {
    if (active) registerHost?.(node)
  }, [active, registerHost])

  if (!active || registerHost === undefined) return null
  return <div ref={hostRef} className="shell-toast-host" data-shell-toast-host="true" />
}
