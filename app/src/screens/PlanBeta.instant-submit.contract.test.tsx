import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import * as recordSave from "../domain/account/instant-plan-record-save"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import type { InstantPlanEntry } from "../domain/instant-plan-contract"

const currentEntry: InstantPlanEntry = { kind: "CURRENT_RECORD", eventDistanceM: 1500, performanceSeconds: 263.4, achievedOn: null }

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function enterRecord() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "1500m" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.type(screen.getByLabelText("분"), "4")
  await user.type(screen.getByLabelText("초"), "23.4")
  return user
}

describe("instant plan record submission recovery", () => {
  it("shows the pending preparation and prevents duplicate submission without activating a plan", async () => {
    let complete!: (result: recordSave.AccountInstantPlanEntryResult) => void
    const prepare = vi.spyOn(recordSave, "prepareAccountInstantPlanEntry")
      .mockImplementation(() => new Promise(resolve => { complete = resolve }))
    render(<PlanBeta />)
    const user = await enterRecord()
    await user.dblClick(screen.getByRole("button", { name: "기록 입력 완료" }))
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "계획 준비 중…" })).toBeDisabled()
    expect(loadPlanBetaState()).toBeNull()
    await act(async () => { complete({ kind: "pending" }) })
    expect(screen.getByRole("alert")).toHaveTextContent("기록 전송을 기다리고 있어요")
    expect(screen.getByRole("button", { name: "기록 입력 완료" })).toBeEnabled()
    expect(screen.getByLabelText("초")).toHaveValue("23.4")
    expect(loadPlanBetaState()).toBeNull()
  })

  it("distinguishes an acknowledged record with a failed device copy and keeps the entry for recovery", async () => {
    const prepare = vi.spyOn(recordSave, "prepareAccountInstantPlanEntry")
      .mockResolvedValue({ kind: "cache_failed", entry: currentEntry, recordId: "confirmed-record" })
    render(<PlanBeta />)
    const user = await enterRecord()
    await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      "계정에 기록은 저장됐지만 이 기기의 기록 사본을 준비하지 못했어요. 내 경기 기록에서 확인한 뒤 다시 시도해 주세요.")
    expect(screen.getByLabelText("분")).toHaveValue("4")
    expect(screen.getByLabelText("초")).toHaveValue("23.4")
    expect(screen.getByRole("button", { name: "기록 입력 완료" })).toBeEnabled()
    expect(loadPlanBetaState()).toBeNull()
    await user.click(screen.getByText("기록 관리·훈련표 읽기"))
    expect(screen.getByRole("button", { name: "내 경기 기록" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u })).not.toBeInTheDocument()
    expect(loadPlanBetaState()).toBeNull()
  })

  it("releases the submission lock after an unexpected rejected preparation and retries the same entry", async () => {
    const prepare = vi.spyOn(recordSave, "prepareAccountInstantPlanEntry")
      .mockRejectedValueOnce(new Error("unexpected preparation rejection"))
      .mockResolvedValue({ kind: "ready", entry: currentEntry, recordId: "confirmed-record" })
    render(<PlanBeta />)
    const user = await enterRecord()
    await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
    expect(screen.getByRole("alert")).toHaveTextContent("입력은 그대로 남아 있어요")
    expect(screen.getByRole("button", { name: "기록 입력 완료" })).toBeEnabled()
    expect(screen.getByLabelText("분")).toHaveValue("4")
    expect(screen.getByLabelText("초")).toHaveValue("23.4")
    expect(loadPlanBetaState()).toBeNull()
    await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls[1]).toEqual(prepare.mock.calls[0])
    expect(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u })).toBeVisible()
    expect(loadPlanBetaState()).toBeNull()
  })
})
