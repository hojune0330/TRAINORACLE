import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PlanBeta } from "../PlanBeta"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage, savePlanBetaState } from "../../domain/plan-beta-store"
import { planBetaStateV3Schema, planHistoryListSchema } from "../../domain/plan-beta-schema"
import { planHistorySnapshotContent } from "../../domain/plan-history-snapshot-content"
import { advancePeriodizationContext, createInitialPeriodizationContext } from "../../domain/periodization-lineage"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

vi.mock("../../domain/account/plan-cloud-backup", () => ({
  planCloudBackupEnabled: () => false, archivePlanOnServer: async () => {},
  backupActivePlanToServer: async () => ({ kind: "unavailable" }),
  loadLatestPlanFromServer: async () => ({ kind: "unavailable" }),
}))
vi.mock("../../domain/account/supabase-client", () => ({ supabase: async () => null }))

const HISTORY = "trainoracle.plan-beta.history.v1"
const NOW = "2026-10-01T03:00:00.000Z"
function completed(ordinal = 6) {
  const base = stateFixture()
  if (base.version !== 3) throw Error("Expected V3 fixture")
  let periodization = createInitialPeriodizationContext(base.activePlan.candidateId, base.generatedAt)!
  for (let n = 1; n < ordinal; n++) periodization = advancePeriodizationContext(periodization, new Date(Date.UTC(2026, 7, n)).toISOString())!
  return planBetaStateV3Schema.parse({ ...base, periodization,
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
}
function seedHistory() {
  const rows = Array.from({ length: 18 }, (_, i) => planHistorySnapshotContent(
    { ...completed(i + 1), progress: [{ sessionDay: 1, sessionSlot: "AM", state: "RESTED" }] },
    new Date(Date.UTC(2026, 8, 20 - i)).toISOString(), "MANUAL"))
  localStorage.setItem(HISTORY, JSON.stringify(planHistoryListSchema.parse(rows)))
  return rows
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW))
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic test forbids network") }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })

describe("ordinary next-plan draft preservation", () => {
  it("keeps the active plan and all eighteen originals while browsing, cancelling and reopening", async () => {
    seedHistory()
    expect(savePlanBetaState(completed()).ok).toBe(true)
    const active = localStorage.getItem(activePlanBetaStorageKey()), history = localStorage.getItem(HISTORY)
    const view = render(<PlanBeta />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }))
    await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(active)
    expect(localStorage.getItem(HISTORY)).toBe(history)
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
    await screen.findByRole("button", { name: "이 일정으로 시작" })
    const navigate = vi.fn(), confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    confirm.mockReturnValue(true)
    expect(runDraftSafeNavigation(() => view.unmount())).toBe(true)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(active)
    expect(localStorage.getItem(HISTORY)).toBe(history)
    render(<PlanBeta />)
    expect(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })).toBeEnabled()
  })
  it("returns directly to the unchanged current plan without making the athlete repeat intake", async () => {
    const original = completed()
    savePlanBetaState(original)
    render(<PlanBeta />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }))
    await user.click(await screen.findByRole("button", { name: "현재 계획으로 돌아가기" }))
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: original })
    expect(localStorage.getItem(HISTORY)).toBeNull()
    expect(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })).toBeEnabled()
  })
  it.each([6, 18])("activates the actual selected successor of frame %i once and archives only at acceptance", async ordinal => {
    const previous = seedHistory(), original = completed(ordinal)
    savePlanBetaState(original)
    render(<PlanBeta />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }))
    await user.click(await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
    await user.click(await screen.findByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => {
      const selected = readPlanBetaStateFromStorage()
      expect(selected.kind === "loaded" && selected.state.version === 3 && selected.state.periodization)
        .toEqual(advancePeriodizationContext(original.periodization!, NOW))
    })
    const read = readPlanBetaStateFromStorage()
    expect(read.kind).toBe("loaded")
    if (read.kind !== "loaded" || read.state.version !== 3) throw Error("Missing saved successor")
    expect(read.state.periodization).toEqual(advancePeriodizationContext(original.periodization!, NOW))
    const history = planHistoryListSchema.parse(JSON.parse(localStorage.getItem(HISTORY)!))
    expect(history).toHaveLength(18)
    expect(history[0]).toMatchObject({ originalPlan: original })
    expect(history.slice(1)).toEqual(previous.slice(0, 17))
  })
})
