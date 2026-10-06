import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useAppOverlayNavigation } from "./components/AppOverlayNavigation"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"

vi.mock("./screens/Home", () => ({ Home: () => {
  const navigation = useAppOverlayNavigation()
  return <section><h1>출발 화면</h1><input aria-label="남겨 둔 입력" />
    <button type="button" onClick={() => navigation?.openPaceCalculator?.()}>페이스 도구 열기</button></section>
} }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: () => <p>일지</p> }))
vi.mock("./DeferredMobileScreens", async () => {
  const { PaceCalculator } = await import("./screens/PaceCalculator")
  return { DeferredMobileScreens: { PaceCalculator } }
})
import { AppShell } from "./AppShell"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); window.history.replaceState(null, "", "/?app=1") })
afterEach(() => { cleanup(); setActiveLocalAccount(null); localStorage.clear() })

it("keeps semantic stages in Back without adding entries while typing", async () => {
  render(<AppShell />)
  fireEvent.change(screen.getByRole("textbox", { name: "남겨 둔 입력" }), { target: { value: "보존" } })
  fireEvent.click(screen.getByRole("button", { name: "페이스 도구 열기" }))
  fireEvent.click(await screen.findByRole("button", { name: "800m" }))
  const length = window.history.length
  fireEvent.change(screen.getByRole("textbox", { name: "분" }), { target: { value: "2" } })
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "1.5" } })
  expect(window.history.length).toBe(length)
  fireEvent.click(screen.getByRole("button", { name: "페이스 보기" }))
  fireEvent.click(screen.getByRole("button", { name: "페이스 표" }))
  expect(screen.getByRole("heading", { name: "비슷한 페이스 비교" })).toBeVisible()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("heading", { name: "내 기록으로 페이스 계산" })).toBeVisible())
  expect(screen.getByText("0:30.4")).toBeVisible()
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("textbox", { name: "초" })).toHaveValue("1.5"))
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("heading", { name: "어떤 종목의 기록인가요?" })).toBeVisible())
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("textbox", { name: "남겨 둔 입력" })).toHaveValue("보존"))
  expect(JSON.stringify(window.history.state)).not.toContain("121.5")
})

it("invalidates pace callbacks and private tool state on account switch", async () => {
  render(<AppShell />)
  fireEvent.click(screen.getByRole("button", { name: "페이스 도구 열기" }))
  await screen.findByRole("heading", { name: "어떤 종목의 기록인가요?" })
  act(() => setActiveLocalAccount("synthetic-other-owner"))
  await waitFor(() => expect(screen.queryByRole("heading", { name: "어떤 종목의 기록인가요?" })).not.toBeInTheDocument())
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("heading", { name: "출발 화면" })).toBeVisible())
  act(() => window.history.forward())
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByRole("heading", { name: "어떤 종목의 기록인가요?" })).not.toBeInTheDocument()
})
