import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { OracleTopicId } from "./domain/oracle-exploration"
import type { LogEntryProps } from "./screens/LogEntry"

const fixture = vi.hoisted(() => ({
  message: undefined as string | undefined,
  entry: { id: "review-synthetic", kind: "post-session" as const,
    date: "2026-09-21", savedAt: "2026-09-21T00:00:00.000Z",
    syncState: "synced" as const, system: "run" as const, title: "Synthetic review",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" },
}))
vi.mock("./screens/Home", () => ({ Home: ({onOpenOracle}: {onOpenOracle:(id:OracleTopicId)=>void}) =>
  <button onClick={() => onOpenOracle("compare")}>Open review topic</button> }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({onDone, onBack}:LogEntryProps) =>
  <><button onClick={() => onDone?.("post-session", fixture.entry, undefined, fixture.message)}>Complete synthetic save</button><button onClick={onBack}>Cancel input</button><button onClick={() => onDone?.("post-session", fixture.entry, "안전 검토 필요", fixture.message)}>Save with review</button></> }))
vi.mock("./domain/oracle-personal-result", () => ({ buildOraclePersonalResult: ({topicId}:{topicId:OracleTopicId}) => ({
  status:"missing", headline:`${topicId} result`, summary:"Missing synthetic data", source:"synthetic", rows:[],
  unit:"", detail:"test", action:"log", actionLabel:"Add synthetic entry", fingerprint:null,
}) }))
vi.mock("./DeferredMobileScreens", async () => {
  const {OracleExplore} = await import("./screens/OracleExplore")
  return { DeferredMobileScreens: { OracleExplore } }
})
import { AppShell } from "./AppShell"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear();
  window.history.replaceState(null,"","/?app=1"); fixture.message=undefined })
afterEach(cleanup)

it.each([undefined, "일지를 계정에 저장했어요."])("returns to result after normal save message %s", async (message) => {
  fixture.message=message
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록"}))
  await user.click(screen.getByRole("button",{name:"Add synthetic entry"}))
  await user.click(screen.getByRole("button",{name:"Complete synthetic save"}))
  await waitFor(() => expect(screen.getByRole("heading",{name:"compare result"})).toBeVisible())
})

it("restores personal mode after next topic and browser back", async () => {
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록"}))
  await user.selectOptions(screen.getByRole("combobox",{name:"분석 주제"}),"change")
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("combobox",{name:"분석 주제"})).toHaveValue("compare"))
  expect(screen.getByRole("button",{name:"내 기록"})).toHaveAttribute("aria-pressed","true")
})

it("returns to the originating personal topic on cancellation", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  await user.click(screen.getByRole("button", { name: "Cancel input" }))
  expect(screen.getByRole("heading", { name: "compare result" })).toBeVisible()
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
})

it("restores the originating topic on browser Back from input", async () => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "Open review topic" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.click(screen.getByRole("button", { name: "Add synthetic entry" }))
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("heading", { name: "compare result" })).toBeVisible())
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
