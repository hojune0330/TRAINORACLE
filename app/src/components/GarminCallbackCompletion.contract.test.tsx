import { StrictMode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { GarminConnectionPanel } from "./GarminConnectionPanel"
import { syntheticGarminOwner as owner, syntheticGarminStatus as status } from "./GarminConnectionPanel.test-fixtures"
import { captureGarminCallback, GARMIN_VERSION, hasGarminCallback, readGarminCallback, rememberGarminAttempt, type GarminTransport } from "../domain/account/garmin-integration"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

function returnFromGarmin(remember = true) {
  const state = "x".repeat(43)
  if (remember) expect(rememberGarminAttempt(owner, { schemaVersion: GARMIN_VERSION, state,
    authorizationUrl: `https://connect.garmin.com/oauth?state=${state}&response_type=code&code_challenge_method=S256`,
    expiresAt: new Date(Date.now() + 300000).toISOString() })).toBe(true)
  window.history.replaceState(null, "", `/?garmin_callback=1&code=synthetic-code&state=${state}`)
  captureGarminCallback()
}
beforeEach(() => { vi.stubEnv("VITE_GARMIN_AUTHORIZATION_ORIGIN", "https://connect.garmin.com"); setActiveLocalAccount(owner) })
afterEach(() => { cleanup(); sessionStorage.clear(); readGarminCallback(owner); setActiveLocalAccount(null); vi.unstubAllEnvs() })

it("waits for confirmed storage before using a one-time return", async () => {
  returnFromGarmin()
  const transport = vi.fn<GarminTransport>()
  render(<GarminConnectionPanel ownerId={owner} configured featureEnabled inlineSetup storageReadiness="checking" transport={transport} />)
  await act(async () => {})
  expect(transport).not.toHaveBeenCalled()
  expect(hasGarminCallback()).toBe(true)
})

it("survives owner re-verification before sending and dispatches once before status refresh", async () => {
  returnFromGarmin()
  let resume!: () => void, completionAttempts = 0
  const sent: string[] = []
  const transport: GarminTransport = async (_owner, request, signal, current, claim) => {
    if (request.action === "complete") {
      completionAttempts++
      if (completionAttempts === 1) await new Promise<void>(resolve => { resume = resolve })
      if (signal.aborted || !current() || !claim?.()) return { ok: false, code: "STALE_RESPONSE" }
    }
    sent.push(request.action)
    if (request.action === "complete") return { ok: true, data: { schemaVersion: GARMIN_VERSION, connection: status.connection } }
    if (request.action === "status") return { ok: true, data: status }
    return { ok: true, data: { schemaVersion: GARMIN_VERSION, items: [], nextCursor: null } }
  }
  const panel = (id: string | null, readiness: "checking" | "ready") => <StrictMode><GarminConnectionPanel ownerId={id}
    configured featureEnabled inlineSetup storageReadiness={readiness} transport={transport} /></StrictMode>
  const view = render(panel(owner, "ready"))
  await waitFor(() => expect(completionAttempts).toBe(1))
  expect(hasGarminCallback()).toBe(true)
  act(() => setActiveLocalAccount(null))
  view.rerender(panel(null, "checking"))
  resume()
  act(() => setActiveLocalAccount(owner))
  view.rerender(panel(owner, "ready"))
  await waitFor(() => expect(sent).toEqual(["complete", "status", "inbox"]))
  expect(hasGarminCallback()).toBe(false)
  expect(screen.getByText(/Garmin 계정이 연결됐어요/)).toBeVisible()
})

it("keeps a lost return-session explanation after later PENDING status checks", async () => {
  returnFromGarmin(false)
  const actions: string[] = []
  const transport: GarminTransport = async (_owner, request) => {
    actions.push(request.action)
    return { ok: true, data: { ...status, connection: { ...status.connection, state: "PENDING" } } }
  }
  render(<GarminConnectionPanel ownerId={owner} configured featureEnabled transport={transport} />)
  const notice = await screen.findByText(/이 창에서 시작한 Garmin 연결 요청을 찾지 못했어요/)
  await waitFor(() => expect(actions).toEqual(["status"]))
  fireEvent.click(screen.getByRole("button", {name:"다시 확인"}))
  await waitFor(() => expect(actions).toEqual(["status", "status"]))
  expect(notice).toBeVisible()
})
