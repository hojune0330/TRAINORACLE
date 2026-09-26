// Review fixture: copy to app/src/OracleFinalReview.repro.test.tsx to rerun.
// Imports are intentionally relative to that original execution location.
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
vi.mock("./screens/LogEntry", () => ({ LogEntry: ({onDone}:LogEntryProps) =>
  <button onClick={() => onDone?.("post-session", fixture.entry, fixture.message)}>Complete synthetic save</button> }))
vi.mock("./domain/oracle-personal-result", () => ({ buildOraclePersonalResult: ({topicId}:{topicId:OracleTopicId}) => ({
  status:"missing", headline:`${topicId} result`, summary:"Missing synthetic data", source:"synthetic", rows:[],
  unit:"", detail:"test", action:"log", actionLabel:"Add synthetic entry", fingerprint:null,
}) }))
vi.mock("./DeferredMobileScreens", async () => {
  const {OracleExplore} = await import("./screens/OracleExplore")
  return { DeferredMobileScreens: { OracleExplore } }
})
import { AppShell } from "./AppShell"

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear();
  window.history.replaceState(null,"","/?app=1"); fixture.message=undefined })
afterEach(cleanup)

it.each([undefined, "일지를 계정에 저장했어요."])("returns to result after normal save message %s", async (message) => {
  fixture.message=message
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록",exact:true}))
  await user.click(screen.getByRole("button",{name:"Add synthetic entry"}))
  await user.click(screen.getByRole("button",{name:"Complete synthetic save"}))
  await waitFor(() => expect(screen.getByRole("heading",{name:"compare result"})).toBeVisible())
})

it("restores personal mode after next topic and browser back", async () => {
  const user=userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button",{name:"Open review topic"}))
  await user.click(screen.getByRole("button",{name:"내 기록",exact:true}))
  await user.selectOptions(screen.getByRole("combobox",{name:"분석 주제"}),"change")
  act(() => window.history.back())
  await waitFor(() => expect(screen.getByRole("combobox",{name:"분석 주제"})).toHaveValue("compare"))
  expect(screen.getByRole("button",{name:"내 기록",exact:true})).toHaveAttribute("aria-pressed","true")
})
