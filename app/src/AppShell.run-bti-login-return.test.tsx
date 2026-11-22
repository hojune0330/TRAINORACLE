import React from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import type { AccountAdmissionReady } from "./screens/Account"
import { authReturnUrl } from "./domain/account/auth"
import { createPendingAccountAuthAttempt, readPendingAccountSetup, writePendingAccountSetup, type AuthReturnIntent } from "./domain/account/auth-onboarding"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { clearRunBtiLoginReturn, rememberRunBtiLogin, takeRunBtiLoginReturn } from "./domain/account/run-bti-login-return"

const entry = "aaaaaaaa-1111-4111-8111-111111111111"
const attempt = "a".repeat(32)

vi.mock("./domain/account/config", () => ({ accountFeatureEnabled: () => true, accountConfig: () => null }))
vi.mock("./domain/account/verified-account-scope", () => ({
  startVerifiedAccountScope: (cb: (status: string) => void) => { cb("READY"); return () => {} },
}))
vi.mock("./screens/Home", () => ({ Home: () => <div>홈</div> }))
vi.mock("./screens/RunBtiAccountPanel", () => ({
  default: ({token, onLogin}: {token: string; onLogin: () => void}) =>
    <><output data-testid="token">{token}</output><button onClick={onLogin}>검사 로그인</button></>,
}))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Trends: () => <div>추세</div>,
  OracleProfileV2: () => <h1>일반 프로필</h1>,
  RunningProfile: () => <h1>일반 프로필</h1>,
  Account: ({onAdmissionReady, returnIntent}: {
    onAdmissionReady: (event: AccountAdmissionReady) => void; returnIntent: AuthReturnIntent
  }) => <><output data-testid="intent">{returnIntent}</output><button onClick={() => {
    setActiveLocalAccount("member")
    onAdmissionReady({attemptId: "a".repeat(32), userId: "member", returnIntent, entryMode: "login"})
  }}>로그인 검증 완료</button></>,
} }))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  vi.stubEnv("VITE_KILL_ORACLE_V2", "false")
  window.history.replaceState(null, "", "/TRAINORACLE/?run-bti-profile=" + entry)
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.useRealTimers(); vi.unstubAllEnvs() })

it("returns a guest to the selected test after OAuth and drops the preview on an account change", async () => {
  const user = userEvent.setup()
  const first = render(<AppShell />)
  expect(await screen.findByTestId("token")).toHaveTextContent(entry)
  await user.click(screen.getByText("검사 로그인"))
  expect(await screen.findByTestId("intent")).toHaveTextContent("run-bti")

  const pending = createPendingAccountAuthAttempt({entryMode: "login", method: "google", returnIntent: "run-bti", attemptId: attempt})
  writePendingAccountSetup(pending)
  expect(readPendingAccountSetup()?.returnIntent).toBe("run-bti")
  const callback = authReturnUrl(location.href, pending.attemptId)!
  expect(callback).not.toContain(entry)
  first.unmount()
  window.history.replaceState(null, "", callback)
  render(<AppShell />)
  expect(await screen.findByTestId("intent")).toHaveTextContent("run-bti")
  await user.click(screen.getByText("로그인 검증 완료"))
  expect(await screen.findByTestId("token")).toHaveTextContent(entry)
  expect(takeRunBtiLoginReturn(null)).toBeNull()

  act(() => setActiveLocalAccount("other-member"))
  expect(await screen.findByRole("heading", {name: "일반 프로필"})).toBeVisible()
})

it("consumes the saved-profile entry only once and rejects cancelled or expired entries", () => {
  rememberRunBtiLogin("saved")
  expect(takeRunBtiLoginReturn(null)).toBe("saved")
  expect(takeRunBtiLoginReturn(null)).toBeNull()
  rememberRunBtiLogin(entry)
  clearRunBtiLoginReturn()
  expect(takeRunBtiLoginReturn(null)).toBeNull()

  vi.useFakeTimers()
  const marker = rememberRunBtiLogin(entry)
  vi.setSystemTime(marker.expiresAt)
  expect(takeRunBtiLoginReturn(null)).toBeNull()
})
