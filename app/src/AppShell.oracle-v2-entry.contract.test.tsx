import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { authReturnUrl } from "./domain/account/auth"
import type { GuestOracleSession } from "./screens/OracleProfileV2"

const runtime = vi.hoisted(() => ({ account: false,
  currentUser: vi.fn<() => Promise<{ id: string } | null>>(),
  auth: null as ((user: { id: string } | null) => void) | null,
  comparison: vi.fn(),
  guestCallback: undefined as ((session: GuestOracleSession | null) => void) | undefined,
}))
vi.mock("./domain/account/config", () => ({ accountFeatureEnabled: () => runtime.account, accountConfig: () => null }))
vi.mock("./domain/account/auth", async original => ({
  ...await original<typeof import("./domain/account/auth")>(), currentUser: runtime.currentUser,
  onAuthChange: (listener: typeof runtime.auth) => { runtime.auth = listener; return () => { runtime.auth = null } },
}))
vi.mock("./domain/account/account-service", async original => ({
  ...await original<typeof import("./domain/account/account-service")>(),
  loadPrivateProfileSetupStatus: async () => ({ ok: true, ready: true }),
}))
vi.mock("./domain/account/oracle-profile-comparison-api", () => ({ requestProfileComparison: runtime.comparison }))
vi.mock("./screens/Home", () => ({ Home: () => <h1>Entry home</h1> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Trends: ({ onOpenRunningProfile }: { onOpenRunningProfile: () => void }) => <button onClick={onOpenRunningProfile}>Open profile</button>,
  RunningProfile: () => <h1>V1 profile</h1>,
  OracleProfileV2: ({ guestSession, onGuestSessionChange, onBack, onNavigate }: {
    guestSession?: GuestOracleSession | null; onGuestSessionChange?: (session: GuestOracleSession | null) => void; onBack: () => void; onNavigate: (destination: "METHODS") => void
  }) => {
    runtime.guestCallback = onGuestSessionChange
    const [invitation] = React.useState(() => new URLSearchParams(window.location.hash.slice(1)).get("oracle-compare-invite"))
    return <><h1>V2 profile</h1><output aria-label="invitation">{invitation ?? "none"}</output>
      <output aria-label="guest memory">{guestSession?.selectedCharacter ?? "none"}</output>
      <button onClick={() => onGuestSessionChange?.({ ownerKey: "guest", answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, selectedCharacter: "STRUCTURE" })}>Complete guest</button>
      <button onClick={onBack}>Close profile</button>
      <button onClick={() => onNavigate("METHODS")}>Read methods</button>
    </>
  },
  TrainingContent: ({ onBack }: { onBack: () => void }) => <><h1>Training reading</h1><button onClick={onBack}>Close reading</button></>,
  Account: ({ onBack }: { onBack: () => void }) => <><h1>Account entry</h1><button onClick={onBack}>Cancel login</button></>,
} }))
import { AppShell } from "./AppShell"

const code = "a".repeat(43), otherCode = "b".repeat(43)
const pendingKey = "trainoracle.oracle-v2.invitation-return"
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  runtime.account = false; runtime.currentUser.mockReset().mockResolvedValue(null); runtime.comparison.mockReset()
  vi.stubEnv("DEV", false); vi.stubEnv("PROD", true)
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "false"); vi.stubEnv("VITE_KILL_ORACLE_V2", "false")
  window.history.replaceState(null, "", "/TRAINORACLE/?app=1")
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("No network in entry tests") }))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function openProfile() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "오라클" }))
  await user.click(await screen.findByRole("button", { name: "Open profile" }))
}
it("retains a completed guest result within the app only and clears it on scope change and remount", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  const user = userEvent.setup()
  const first = render(<AppShell />)
  await openProfile()
  const localBefore = { ...localStorage }, sessionBefore = { ...sessionStorage }
  await user.click(screen.getByRole("button", { name: "Complete guest" }))
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("STRUCTURE")
  await user.click(screen.getByRole("button", { name: "Close profile" }))
  await openProfile()
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("STRUCTURE")
  expect({ ...localStorage }).toEqual(localBefore)
  expect({ ...sessionStorage }).toEqual(sessionBefore)
  expect(JSON.stringify(window.history.state)).not.toContain("STRUCTURE")
  const staleCallback = runtime.guestCallback
  act(() => { setActiveLocalAccount("synthetic-scope"); setActiveLocalAccount(null) })
  act(() => staleCallback?.({ ownerKey: "guest", answers: { STRUCTURE_1: 5 }, selectedCharacter: "STRUCTURE" }))
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("none")
  await user.click(screen.getByRole("button", { name: "Close profile" }))
  await openProfile()
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("none")
  await user.click(screen.getByRole("button", { name: "Complete guest" }))
  first.unmount()
  window.history.replaceState(null, "", "?app=1")
  render(<AppShell />)
  await openProfile()
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("none")
})
it("opens V2 training reading from Oracle and restores the original overlay and guest result", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  const user = userEvent.setup()
  render(<AppShell />)
  await openProfile()
  await user.click(screen.getByRole("button", { name: "Complete guest" }))
  await user.click(screen.getByRole("button", { name: "Read methods" }))
  expect(await screen.findByRole("heading", { name: "Training reading" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Close reading" }))
  expect(await screen.findByRole("heading", { name: "V2 profile" })).toBeVisible()
  expect(screen.getByLabelText("guest memory")).toHaveTextContent("STRUCTURE")
})

it("production flag opens V2 from the normal profile entry without a preview query", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  render(<AppShell />); await openProfile()
  expect(await screen.findByRole("heading", { name: "V2 profile" })).toBeVisible()
  expect(window.location.search).toBe("?app=1")
})
it.each(["false", "", "1", "TRUE"])("flag %s preserves V1 despite development mode, preview query and invitation", async flag => {
  vi.stubEnv("DEV", true); vi.stubEnv("PROD", false); vi.stubEnv("VITE_FEATURE_ORACLE_V2", flag)
  window.history.replaceState(null, "", `?app=1&oracleV2=1#oracle-compare-invite=${code}`)
  sessionStorage.setItem(pendingKey, code)
  render(<AppShell />); await openProfile()
  expect(await screen.findByRole("heading", { name: "V1 profile" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  expect(sessionStorage.getItem(pendingKey)).toBeNull()
  expect(runtime.comparison).not.toHaveBeenCalled()
})
it("kill switch overrides the production rollout flag and direct query", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); vi.stubEnv("VITE_KILL_ORACLE_V2", "true")
  window.history.replaceState(null, "", "?app=1&oracleV2=1")
  render(<AppShell />); await openProfile()
  expect(await screen.findByRole("heading", { name: "V1 profile" })).toBeVisible()
})
it("supports a production direct V2 entry and keeps account-disabled invitations read-only", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  window.history.replaceState(null, "", `?app=1&oracleV2=1#oracle-compare-invite=${code}`)
  render(<AppShell />)
  expect(await screen.findByRole("heading", { name: "V2 profile" })).toBeVisible()
  expect(screen.getByLabelText("invitation")).toHaveTextContent(code)
  expect(runtime.comparison).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})
it("preserves only the exact invitation through the real hash-stripping login return URL", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); runtime.account = true
  window.history.replaceState({ unrelated: "retained" }, "", `/TRAINORACLE/?app=1#oracle-compare-invite=${code}&unrelated=kept`)
  const first = render(<AppShell />)
  expect(await screen.findByRole("heading", { name: "Account entry" })).toBeVisible()
  expect(sessionStorage.getItem(pendingKey)).toBe(code)
  expect(localStorage.getItem(pendingKey)).toBeNull()
  const returnUrl = authReturnUrl()!
  expect(new URL(returnUrl).hash).toBe(""); expect(returnUrl).not.toContain(code)
  first.unmount()
  window.history.replaceState({ unrelated: "retained" }, "", returnUrl)
  runtime.currentUser.mockResolvedValue({ id: "synthetic-a" })
  render(<AppShell />)
  expect(await screen.findByRole("heading", { name: "V2 profile" })).toBeVisible()
  expect(screen.getByLabelText("invitation")).toHaveTextContent(code)
  expect(window.location.pathname).toBe("/TRAINORACLE/")
  expect(window.history.state.unrelated).toBe("retained")
  expect(JSON.stringify(window.history.state)).not.toContain(code)
  expect(window.location.search).not.toContain(code)
  expect(sessionStorage.getItem(pendingKey)).toBeNull()
  expect(runtime.comparison).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})
it("survives same-page auth fragment cleanup and resumes only after the auth callback", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); runtime.account = true
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${code}`)
  render(<AppShell />)
  await screen.findByRole("heading", { name: "Account entry" })
  act(() => { window.history.replaceState(null, "", "?app=1"); window.dispatchEvent(new HashChangeEvent("hashchange")) })
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  runtime.currentUser.mockResolvedValue({ id: "synthetic-a" })
  act(() => runtime.auth?.({ id: "synthetic-a" }))
  expect(await screen.findByRole("heading", { name: "V2 profile" })).toBeVisible()
  expect(screen.getByLabelText("invitation")).toHaveTextContent(code)
  expect(runtime.comparison).not.toHaveBeenCalled()
})
it("waits for verified initial authentication instead of trusting a retained local owner", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); runtime.account = true
  let resolve!: (user: { id: string } | null) => void
  runtime.currentUser.mockImplementation(() => new Promise(done => { resolve = done }))
  setActiveLocalAccount("retained-owner")
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${code}`)
  render(<AppShell />)
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  await act(async () => resolve(null))
  expect(await screen.findByRole("heading", { name: "Account entry" })).toBeVisible()
})
it("authentication failure opens account recovery, not V2 with a retained owner", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); runtime.account = true
  runtime.currentUser.mockRejectedValue(Error("synthetic auth failure")); setActiveLocalAccount("retained-owner")
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${code}`)
  render(<AppShell />)
  expect(await screen.findByRole("heading", { name: "Account entry" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  expect(runtime.comparison).not.toHaveBeenCalled()
})
it("does not resume tab storage from an unrelated non-account visit", () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); sessionStorage.setItem(pendingKey, code)
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "Entry home" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  expect(sessionStorage.getItem(pendingKey)).toBeNull()
})
it("cancels the pending login return without accepting or later reopening the invitation", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true"); runtime.account = true
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${code}`)
  render(<AppShell />)
  await userEvent.setup().click(await screen.findByRole("button", { name: "Cancel login" }))
  expect(sessionStorage.getItem(pendingKey)).toBeNull()
  runtime.currentUser.mockResolvedValue({ id: "synthetic-a" })
  act(() => runtime.auth?.({ id: "synthetic-a" }))
  await waitFor(() => expect(screen.getByRole("heading", { name: "Entry home" })).toBeVisible())
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
})
it.each(["short", `${code}&oracle-compare-invite=${otherCode}`])("ignores malformed or ambiguous fragments: %s", async invalid => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${invalid}`)
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "Entry home" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "V2 profile" })).toBeNull()
  expect(runtime.comparison).not.toHaveBeenCalled()
})
it("a new explicit invitation remounts an already-open V2 reader without auto-consent", async () => {
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  window.history.replaceState(null, "", `?app=1#oracle-compare-invite=${code}`)
  render(<AppShell />); await screen.findByRole("heading", { name: "V2 profile" })
  act(() => { window.history.replaceState(window.history.state, "", `?app=1#oracle-compare-invite=${otherCode}`)
    window.dispatchEvent(new HashChangeEvent("hashchange")) })
  expect(screen.getByLabelText("invitation")).toHaveTextContent(otherCode)
  expect(runtime.comparison).not.toHaveBeenCalled()
})
