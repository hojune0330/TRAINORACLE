import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ journal: vi.fn(), records: vi.fn(), publicProfile: true }))
vi.mock("./domain/account/useAccountJournalRuntime", () => ({ useAccountJournalRuntime: mocks.journal }))
vi.mock("./domain/account/useAccountAthleteRecordsRuntime", () => ({ useAccountAthleteRecordsRuntime: mocks.records }))
vi.mock("./domain/product-features", () => ({ productFeatures: () => ({ publicProfile: mocks.publicProfile }) }))
vi.mock("./components/AccountJournalStorageStatus", () => ({ AccountJournalStorageStatus: () => null }))
vi.mock("./components/InstallShortcut", () => ({ InstallShortcutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock("./AppShell", () => ({
  AppShell: () => <h1>App shell</h1>,
  useIsMobileShell: () => { const [mobile] = React.useState(true); return mobile },
}))
vi.mock("./screens/PublicProfilePage", () => ({ PublicProfilePage: () => <h1>Public profile</h1> }))
import App from "./App"

afterEach(() => { cleanup(); mocks.publicProfile = true; window.history.replaceState(null, "", "/") })

it("runs the record runtime but not private journal hydration on direct public entry, with stable hook order on route change", async () => {
  window.history.replaceState(null, "", "/?profile=friend")
  const view = render(<App />)
  expect(await screen.findByText("Public profile")).toBeVisible()
  expect(mocks.journal).toHaveBeenLastCalledWith(false)
  expect(mocks.records).toHaveBeenCalledWith()
  window.history.replaceState(null, "", "/?app=1")
  view.rerender(<App />)
  expect(screen.getByText("App shell")).toBeVisible()
  expect(mocks.journal).toHaveBeenLastCalledWith(true)
})

it("keeps the normal app runtime enabled when the public feature is disabled despite a profile parameter", () => {
  mocks.publicProfile = false
  window.history.replaceState(null, "", "/?profile=friend")
  render(<App />)
  expect(screen.getByText("App shell")).toBeVisible()
  expect(mocks.journal).toHaveBeenLastCalledWith(true)
})
