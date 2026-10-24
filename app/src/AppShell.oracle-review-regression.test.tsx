import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { OracleTopicId } from "./domain/oracle-exploration"
import type { LogEntryProps } from "./screens/LogEntry"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

const fixture = vi.hoisted(() => ({
  message: undefined as string | undefined,
  realEntry: false,
  entry: { id: "review-synthetic", kind: "post-session" as const,
    date: "2026-09-21", savedAt: "2026-09-21T00:00:00.000Z",
    syncState: "synced" as const, system: "run" as const, title: "Synthetic review",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" },
}))
vi.mock("./screens/Home", () => ({ Home: ({onOpenOracle}: {onOpenOracle:(id:OracleTopicId)=>void}) =>
  <button onClick={() => onOpenOracle("compare")}>Open review topic</button> }))
vi.mock("./screens/LogEntry", async importOriginal => {
  const { LogEntry } = await importOriginal<typeof import("./screens/LogEntry")>()
  return { LogEntry: (props: LogEntryProps) => fixture.realEntry ? <LogEntry {...props} /> : <>
    <button onClick={() => props.onDone?.("post-session", fixture.entry, undefined, fixture.message)}>Complete synthetic save</button>
    <button onClick={props.onBack}>Cancel input</button>
    <button onClick={() => props.onDone?.("post-session", fixture.entry, "안전 검토 필요", fixture.message)}>Save with review</button>
  </> }
})
vi.mock("./domain/oracle-personal-result", () => ({ buildOraclePersonalResult: ({topicId}:{topicId:OracleTopicId}) => ({
  status:"missing", headline:`${topicId} result`, summary:"Missing synthetic data", source:"synthetic", rows:[],
  unit:"", detail:"test", action:"log", actionLabel:"Add synthetic entry", fingerprint:null,
}) }))
vi.mock("./DeferredMobileScreens", async () => {
  const {OracleExplore} = await import("./screens/OracleExplore")
  // The domain home remains mounted under the topic and its recording flow.
  return { DeferredMobileScreens: { Trends: () => <h1>오라클 분석 홈</h1>, OracleExplore } }
})
import { AppShell } from "./AppShell"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"

beforeEach(async () => { window.localStorage.clear(); window.sessionStorage.clear();
  await initializeCanonicalJournalFixture()
  window.history.replaceState(null,"","/?app=1"); fixture.message=undefined; fixture.realEntry=false })
afterEach(cleanup)

function storedDeviceState() {
  return Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
}

async function forwardKeepsResult(domain: string) {
  const stored = storedDeviceState()
  const historyLength = window.history.length
  const popped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }))
  await act(async () => { window.history.forward(); await popped })
  await waitFor(() => expect(window.history.state.trainoracleOracleLog).toBeUndefined())
  expect(screen.getByRole("heading", { name: "compare result" })).toBeVisible()
  expect(window.history.state.trainoracleDomain).toBe(domain)
  expect(window.history.length).toBe(historyLength)
  expect(screen.queryByRole("button", { name: "Complete synthetic save" })).toBeNull()
  expect(screen.queryByRole("button", { name: "오늘은 쉬었어요" })).toBeNull()
  expect(storedDeviceState()).toEqual(stored)
}

it.each([undefined, "일지를 계정에 저장했어요."])("returns to result after normal save message %s", async (message) => {
  fixture.message=message
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록"}))
  const resultHistoryLength = window.history.length
  const domain = window.history.state.trainoracleDomain
  await user.click(screen.getByRole("button",{name:"Add synthetic entry"}))
  expect(window.history.length).toBe(resultHistoryLength + 1)
  expect(window.history.state.trainoracleDomain).toBe(domain)
  await user.click(screen.getByRole("button",{name:"Complete synthetic save"}))
  await waitFor(() => expect(screen.getByRole("heading",{name:"compare result"})).toBeVisible())
  expect(window.history.length).toBe(resultHistoryLength + 1)
  expect(window.history.state.trainoracleOracleLog).toBeUndefined()
  expect(window.history.state.trainoracleDomain).toBe(domain)
  expect(document.querySelector('[data-toast-priority="receipt"]')).not.toBeNull()
  await forwardKeepsResult(domain)
  expect(document.querySelector('[data-toast-priority="receipt"]')).not.toBeNull()
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  expect(screen.getByRole("button", { name: "Complete synthetic save" })).toBeVisible()
  expect(document.querySelector('[data-toast-priority="receipt"]')).toBeNull()
})

it("restores personal mode after next topic and browser back", async () => {
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록"}))
  await user.selectOptions(screen.getByRole("combobox",{name:"살펴볼 주제"}),"change")
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("combobox",{name:"살펴볼 주제"})).toHaveValue("compare"))
  expect(screen.getByRole("button",{name:"내 기록"})).toHaveAttribute("aria-pressed","true")
})

it("returns to the originating personal topic on cancellation", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  const domain = window.history.state.trainoracleDomain
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  const childHistoryLength = window.history.length
  await user.click(screen.getByRole("button", { name: "Cancel input" }))
  await waitFor(() => expect(screen.getByRole("heading", { name: "compare result" })).toBeVisible())
  expect(window.history.length).toBe(childHistoryLength)
  expect(window.history.state.trainoracleOracleLog).toBeUndefined()
  await forwardKeepsResult(domain)
})

it("does not hide a real safety review behind the result", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  await user.click(screen.getByRole("button", { name: "Save with review" }))
  expect(screen.getByRole("alert")).toHaveTextContent("안전 검토 필요")
  expect(screen.queryByRole("heading", { name: "compare result" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "기록하기" }))
  expect(screen.getByRole("alert")).toHaveTextContent("안전 검토 필요")
})

it("restores the originating topic on browser Back from the actual QuickSession first question", async () => {
  fixture.realEntry = true
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  const domain = window.history.state.trainoracleDomain
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  expect(await screen.findByRole("button", { name: "오늘은 쉬었어요" })).toBeVisible()
  expect(window.history.state.trainoracleDomain).toBe(domain)
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("heading", { name: "compare result" })).toBeVisible())
  expect(window.history.state.trainoracleOracleLog).toBeUndefined()
  expect(window.history.state.trainoracleDomain).toBe(domain)
  await forwardKeepsResult(domain)
})

it("does not discard a volatile account draft on browser Back", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  const blocked = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
  try {
    act(() => window.history.back())
    await waitFor(() => expect(blocked).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "Complete synthetic save" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "compare result" })).toBeNull()
  } finally { unregister() }
})
