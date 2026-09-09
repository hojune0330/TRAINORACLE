import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AdjustedPlanSchedule } from "./AdjustedPlanSchedule"
import { AdjustedPlanScheduleV3 } from "./AdjustedPlanScheduleV3"
import { MultiAdjustedPlanScheduleV3 } from "./MultiAdjustedPlanScheduleV3"
import { accountPlanPacketFixture } from "../../domain/account/account-plan.test-fixtures"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { ACCOUNT_PLAN_EVENT } from "../../domain/account/account-plan-service"
import { readStoredAdjustedPlanState } from "../../domain/adjusted-plan-storage-schema"
import { readStoredAdjustedPlanStateV5 } from "../../domain/adjusted-plan-storage-v5-schema"
import { readStoredMultiAdjustedPlanV6 } from "../../domain/adjusted-plan-storage-v6-schema"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"

const mocks = vi.hoisted(() => ({ history: vi.fn<() => Promise<boolean>>(),
  export: vi.fn<() => { kind: "exported"; raw: string; archivedCount: number } | { kind: "invalid" }>() }))
vi.mock("../../domain/account/account-plan-domain", async original => ({
  ...await original<typeof import("../../domain/account/account-plan-domain")>(), ensureAccountPlanHistory: mocks.history,
}))
vi.mock("../../domain/adjusted-plan-backup-v3", () => ({ exportAdjustedPlanBackupV3: mocks.export }))
vi.mock("../../domain/multi-adjusted-plan-backup-v3", () => ({ exportMultiAdjustedPlanBackupV3: mocks.export }))
vi.mock("./MultiPlanCloudControlsV3", () => ({ MultiPlanCloudControlsV3: () => null }))

const create = vi.fn(() => "blob:synthetic-full-history"), revoke = vi.fn()
const file = { kind: "exported" as const, raw: '{"syntheticFullHistory":true}', archivedCount: 18 }
const downloadName = "개인 보관용 계획 파일 받기"
let click: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount("account-a")
  vi.useFakeTimers(); vi.setSystemTime(TODAY)
  mocks.history.mockReset().mockResolvedValue(true); mocks.export.mockReset().mockReturnValue(file)
  create.mockReset().mockReturnValue("blob:synthetic-full-history"); revoke.mockReset()
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})
afterEach(() => {
  cleanup(); setActiveLocalAccount(null); vi.runOnlyPendingTimers(); vi.useRealTimers()
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})
function pending() {
  let resolve!: (value: boolean) => void, reject!: (error: Error) => void
  const promise = new Promise<boolean>((yes, no) => { resolve = yes; reject = no })
  mocks.history.mockReturnValue(promise)
  return { resolve, reject }
}
function element(version: 4 | 5 | 6) {
  const packet = accountPlanPacketFixture(version)
  const onStoredChange = vi.fn()
  if (version === 4) {
    const evidence = [packet.evidence] as Parameters<typeof readStoredAdjustedPlanState>[1]
    const loaded = readStoredAdjustedPlanState(packet.state, evidence)
    if (loaded.kind !== "loaded") throw Error("V4 fixture must validate")
    return <AdjustedPlanSchedule loaded={{ ...loaded, kind: "adjusted_loaded" }} readEvidence={() => evidence!}
      onStoredChange={onStoredChange} onExportPlan={mocks.export} />
  }
  if (version === 5) {
    const evidence = [packet.evidence] as Parameters<typeof readStoredAdjustedPlanStateV5>[1]
    const loaded = readStoredAdjustedPlanStateV5(packet.state, evidence)
    if (loaded.kind !== "loaded") throw Error("V5 fixture must validate")
    return <AdjustedPlanScheduleV3 loaded={loaded} readEvidence={() => evidence!} onStoredChange={onStoredChange} />
  }
  const evidence = [packet.evidence] as Parameters<typeof readStoredMultiAdjustedPlanV6>[1]
  const loaded = readStoredMultiAdjustedPlanV6(packet.state, evidence)
  if (loaded.kind !== "loaded") throw Error("V6 fixture must validate")
  return <MultiAdjustedPlanScheduleV3 loaded={loaded} readEvidence={() => evidence!} onStoredChange={onStoredChange} />
}
function mount(version: 4 | 5 | 6, view = element(version)) {
  const rendered = render(view)
  fireEvent.click(screen.getByText("저장과 이용 안내"))
  return { ...rendered, view, button: screen.getByRole("button", { name: downloadName }) }
}
const noFile = () => { expect(mocks.export).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled() }

describe.each([4, 5, 6] as const)("V%s personal export full-history gate", version => {
  it("waits once, preserves the selected day/current schedule during account events, then exports synchronously and downloads", async () => {
    const wait = pending(), { button, rerender, view } = mount(version)
    const dates = within(screen.getByRole("navigation", { name: "훈련 날짜" })).getAllByRole("button")
    const selected = dates.at(-1)!
    fireEvent.click(selected)
    const dateLabel = selected.textContent
    fireEvent.click(button); fireEvent.click(button)
    expect(button).toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeVisible()
    noFile(); expect(mocks.history).toHaveBeenCalledTimes(1)
    act(() => window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)))
    rerender(React.cloneElement(view))
    expect(within(screen.getByRole("navigation", { name: "훈련 날짜" })).getByRole("button", { name: dateLabel! }))
      .toHaveAttribute("aria-pressed", "true")
    expect(button).toBeDisabled(); noFile()
    await act(async () => { wait.resolve(true) })
    expect(mocks.export).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledTimes(1); expect(click).toHaveBeenCalledTimes(1)
    expect(mocks.export.mock.results[0]?.value).toEqual(file)
    expect(button).not.toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "false")
    act(() => vi.advanceTimersByTime(1000))
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-full-history")
  })

  it("false history gate shows a clear Korean failure without exporting partial history and permits retry", async () => {
    mocks.history.mockResolvedValue(false)
    const { button } = mount(version)
    await act(async () => { fireEvent.click(button) })
    expect(screen.getByRole("alert")).toHaveTextContent("전체 계획 이력을 확인하지 못해 파일을 만들지 않았어요")
    noFile(); expect(button).not.toBeDisabled()
    mocks.history.mockResolvedValue(true)
    await act(async () => { fireEvent.click(button) })
    expect(click).toHaveBeenCalledTimes(1); expect(screen.queryByRole("alert")).toBeNull()
  })

  it("a rejected history load never exports, releases busy state and allows retry", async () => {
    const wait = pending(), { button } = mount(version)
    fireEvent.click(button)
    await act(async () => { wait.reject(Error("synthetic private detail")) })
    noFile(); expect(button).not.toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("계획 파일을 내려받지 못했어요")
    expect(screen.getByRole("alert")).not.toHaveTextContent("synthetic private detail")
    mocks.history.mockResolvedValue(true)
    await act(async () => { fireEvent.click(button) })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it.each([true, false, "reject"] as const)("scope changes while awaiting %s suppress exports and stale error/busy state writes", async outcome => {
    const wait = pending(), { button } = mount(version)
    fireEvent.click(button)
    act(() => setActiveLocalAccount("account-b"))
    expect(button).toHaveAttribute("aria-busy", "false")
    await act(async () => { if (outcome === "reject") wait.reject(Error("stale")); else wait.resolve(outcome) })
    noFile(); expect(screen.queryByRole("alert")).toBeNull()
    // Scope cancellation releases the button; the stale callback contributes no state writes.
    expect(button).toHaveAttribute("aria-busy", "false")
  })

  it("an account A/B/A round trip invalidates the pending export even when the final owner string matches", async () => {
    const wait = pending(), { button } = mount(version)
    fireEvent.click(button)
    act(() => { setActiveLocalAccount("account-b"); setActiveLocalAccount("account-a") })
    await act(async () => { wait.resolve(true) })
    noFile(); expect(screen.queryByRole("alert")).toBeNull()
    expect(button).not.toBeDisabled()
  })

  it("an old cancelled export cannot unlock a newer export after an A/B/A scope transition", async () => {
    const first = pending(), { button } = mount(version)
    fireEvent.click(button)
    act(() => { setActiveLocalAccount("account-b"); setActiveLocalAccount("account-a") })
    const second = pending()
    fireEvent.click(button)
    await act(async () => { first.resolve(true) })
    noFile(); expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mocks.history).toHaveBeenCalledTimes(2)
    await act(async () => { second.resolve(true) })
    expect(click).toHaveBeenCalledTimes(1); expect(button).not.toBeDisabled()
  })

  it("unmount cancels the pending download without touching a newly mounted schedule", async () => {
    const wait = pending(), old = mount(version)
    fireEvent.click(old.button); old.unmount()
    const next = mount(version, old.view)
    await act(async () => { wait.resolve(true) })
    noFile(); expect(next.button).not.toBeDisabled(); expect(screen.queryByRole("alert")).toBeNull()
  })

  it("rechecks scope after the synchronous export callback before creating a download", async () => {
    mocks.export.mockImplementation(() => { setActiveLocalAccount("account-b"); return file })
    const { button } = mount(version)
    await act(async () => { fireEvent.click(button) })
    expect(mocks.export).toHaveBeenCalledTimes(1); expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("rechecks scope immediately before clicking the download and still cleans up the object URL", async () => {
    create.mockImplementation(() => { setActiveLocalAccount("account-b"); return "blob:synthetic-full-history" })
    const { button } = mount(version)
    await act(async () => { fireEvent.click(button) })
    expect(create).toHaveBeenCalledTimes(1); expect(click).not.toHaveBeenCalled(); expect(screen.queryByRole("alert")).toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-full-history")
  })

  it.each(["invalid", "throw", "download"] as const)("handles %s export failure and releases busy state", async mode => {
    if (mode === "invalid") mocks.export.mockReturnValue({ kind: "invalid" })
    if (mode === "throw") mocks.export.mockImplementation(() => { throw Error("codec failed") })
    if (mode === "download") click.mockImplementation(() => { throw Error("download failed") })
    const { button } = mount(version)
    await act(async () => { fireEvent.click(button) })
    expect(button).not.toBeDisabled(); expect(screen.getByRole("alert")).toBeVisible()
    if (mode !== "download") expect(create).not.toHaveBeenCalled()
    else {
      act(() => vi.advanceTimersByTime(1000))
      expect(revoke).toHaveBeenCalledWith("blob:synthetic-full-history")
    }
  })
})
