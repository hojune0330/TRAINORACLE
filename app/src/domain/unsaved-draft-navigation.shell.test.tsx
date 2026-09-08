import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { registerUnsavedDraftGuard } from "./unsaved-draft-navigation"

const renders = vi.hoisted(() => ({ account: 0, home: 0 }))

vi.mock("./account/config", () => ({ accountFeatureEnabled: () => true }))
vi.mock("./account/auth", () => ({ currentUser: async () => null, onAuthChange: () => () => {} }))
vi.mock("./account/product-analytics-service", () => ({ trackProductEvent: async () => {} }))
vi.mock("../screens/Home", () => ({ Home: () => { renders.home++; return <div>home destination</div> } }))
vi.mock("../screens/Guide", () => ({ Guide: () => null }))
vi.mock("../screens/LogDetail", () => ({ LogDetail: () => null }))
vi.mock("../screens/LogEntry", () => ({ LogEntry: () => null }))
vi.mock("../screens/PlanBeta", () => ({ PlanBeta: () => null }))
vi.mock("../screens/Trends", () => ({ Trends: () => null }))
vi.mock("../components/AppShellFrame", () => ({ AppShellFrame: ({ children, onTab }: any) => <>
  <button onClick={() => onTab("journal")}>shell tab</button>{children}
</> }))
vi.mock("../DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Account: ({ onBack, onOpenImport, onOpenRestore }: any) => { renders.account++; return <section aria-label="account source">
    <input aria-label="volatile draft" defaultValue="" />
    <button onClick={onBack}>account back</button>
    <button onClick={onOpenImport}>account import</button>
    <button onClick={onOpenRestore}>account restore</button>
  </section> },
  JournalArchive: () => <div>journal destination</div>,
  ImportActivities: () => <div>import destination</div>,
  RestoreBackup: () => <div>restore destination</div>,
} }))
import { AppShell } from "../AppShell"
import DesktopWorkspace from "../DesktopWorkspace"

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/") })

it.each(["account back", "account import", "account restore", "shell tab"])(
  "guards the actual AppShell %s handler centrally before unmounting", name => {
    window.history.replaceState(null, "", "/?account=1")
    let unsafe = true
    const blocked = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: blocked })
    try {
      render(<AppShell />)
      fireEvent.click(screen.getByRole("button", { name }))
      expect(screen.getByRole("region", { name: "account source" })).toBeInTheDocument()
      expect(blocked).toHaveBeenCalledOnce()
      unsafe = false
      fireEvent.click(screen.getByRole("button", { name }))
      expect(screen.queryByRole("region", { name: "account source" })).toBeNull()
    } finally { unregister() }
  },
)

it("refreshes AppShell hydration readers without remounting the active editor and removes its listener", () => {
  window.history.replaceState(null, "", "/?account=1")
  const removed = vi.spyOn(window, "removeEventListener")
  const view = render(<AppShell />)
  const input = screen.getByRole("textbox", { name: "volatile draft" })
  fireEvent.change(input, { target: { value: "not yet durable" } })
  const before = renders.account
  act(() => { window.dispatchEvent(new Event("trainoracle:account-journals-changed")) })
  expect(renders.account).toBeGreaterThan(before)
  expect(screen.getByRole("textbox", { name: "volatile draft" })).toBe(input)
  expect(input).toHaveValue("not yet durable")
  view.unmount()
  expect(removed).toHaveBeenCalledWith("trainoracle:account-journals-changed", expect.any(Function))
})

it("refreshes DesktopWorkspace hydration readers and removes its listener", () => {
  const removed = vi.spyOn(window, "removeEventListener")
  const view = render(<DesktopWorkspace />)
  const before = renders.home
  act(() => { window.dispatchEvent(new Event("trainoracle:account-journals-changed")) })
  expect(renders.home).toBeGreaterThan(before)
  view.unmount()
  expect(removed).toHaveBeenCalledWith("trainoracle:account-journals-changed", expect.any(Function))
})
