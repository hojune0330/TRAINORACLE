import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "../PlanBeta"
import * as store from "../../domain/plan-beta-store"
import * as flow from "../../domain/plan-beta-flow"
import * as mutationLock from "../../domain/plan-mutation-lock"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

vi.mock("../../domain/account/plan-cloud-backup", () => ({ planCloudBackupEnabled: () => false,
  backupActivePlanToServer: async () => ({ kind: "unavailable" }), loadLatestPlanFromServer: async () => ({ kind: "unavailable" }) }))
vi.mock("../../domain/account/supabase-client", () => ({ supabase: async () => null }))
const intake: store.PlanBetaIntake = { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
  experienceBand: "NEW_TO_RUNNING", availableDayCount: "EVERY_DAY", requestedFrameLength: 9, trainingFocus: "ATP_PC_INTENT",
  secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.spyOn(store, "loadPreviousIntake").mockReturnValue(intake)
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic fixture forbids network") }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })
async function reachCandidates(next = intake) {
  vi.mocked(store.loadPreviousIntake).mockReturnValue(next)
  const view = render(<PlanBeta />)
  fireEvent.click(await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await screen.findByRole("button", { name: "이 일정으로 시작" })
  return view
}
const applyName = "이 훈련으로 적용"
function initialRegion() { return screen.getByRole("region", { name: "첫 주요 훈련 조건" }) }

describe("first-generation MAIN integration", () => {
  it("keeps compact unchecked review optional and saves RPE fallback without hypothetical answers", async () => {
    await reachCandidates()
    const region = initialRegion()
    expect(within(region).getByRole("checkbox")).not.toBeChecked()
    expect(within(region).getByText("상세 훈련 미리보기").closest("details")).not.toHaveAttribute("open")
    expect(screen.queryByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })).toBeNull()
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    const read = store.readPlanBetaStateFromStorage()
    if (read.kind !== "loaded") throw Error("fixture")
    expect(read.state.activePlan.sessions.filter(session => session.role === "QUALITY").every(session =>
      session.prescription.kind === "RPE_TIME_RANGE" && !session.prescription.catalogWorkout)).toBe(true)
    expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull()
  })

  it("applies only genuine answers, premarks their exact dates, and rechecks on date change", async () => {
    await reachCandidates()
    fireEvent.click(within(initialRegion()).getByRole("checkbox"))
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    within(screen.getByTestId("plan-refine")).getAllByRole("button", { hidden: true }).forEach(button => expect(button).toBeDisabled())
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: applyName }))
    await waitFor(() => expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull())
    expect(screen.queryByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })).toBeNull()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "시작일·훈련일 바꾸기" }))
    fireEvent.change(screen.getByLabelText("계획 시작 날짜"), { target: { value: "2026-11-02" } })
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    expect(within(review).getByRole("checkbox")).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
  })

  it("cancelled checkboxes preserve the RPE path; beginner GLY changes purpose without changing experience", async () => {
    const view = await reachCandidates()
    fireEvent.click(within(initialRegion()).getByRole("checkbox"))
    fireEvent.click(within(initialRegion()).getByRole("button", { name: "변경 취소" }))
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    view.unmount()
    await reachCandidates({ ...intake, trainingFocus: "GLY_INTENT" })
    expect(within(initialRegion()).getByRole("status")).toHaveTextContent("처음 시작하는 분께 맞는 해당계 세부 훈련은 아직 준비 중이에요")
    fireEvent.click(screen.getByRole("button", { name: "심폐 반복 목적으로 새 계획 보기" }))
    expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    const read = store.readPlanBetaStateFromStorage()
    if (read.kind !== "loaded") throw Error("fixture")
    expect(read.state.intake).toMatchObject({ trainingFocus: "VO2_INTENT", experienceBand: "NEW_TO_RUNNING" })
  })

  it("eligible GLY uses the existing editor, empty target and explicit longer-time acceptance", async () => {
    await reachCandidates({ ...intake, trainingFocus: "GLY_INTENT", experienceBand: "DEVELOPING" })
    const region = initialRegion()
    fireEvent.click(within(region).getByText(/· 구간 시간 정하기$/u))
    const seconds = within(region).getByRole("spinbutton", { name: /200m 운동 구간/u })
    expect(seconds).toHaveValue(null)
    fireEvent.change(seconds, { target: { value: "45" } })
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(within(region).getByRole("combobox", { name: "시간을 정할 일정" })).toBeDisabled()
    fireEvent.click(within(region).getByRole("checkbox", { name: /준비·회복·정리까지 최대/u }))
    fireEvent.click(within(region).getByRole("button", { name: "이 구성으로 바꾸기" }))
    await waitFor(() => expect(within(initialRegion()).queryByRole("spinbutton")).toHaveValue(null))
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    const read = store.readPlanBetaStateFromStorage()
    if (read.kind !== "loaded") throw Error("fixture")
    const main = read.state.activePlan.sessions.filter(session => session.role === "QUALITY")
    const bindings = main.flatMap(session => session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout ? [session.prescription.catalogWorkout] : [])
    expect(bindings).toHaveLength(1)
    expect(bindings[0]!.inputs).toMatchObject({ experience: "DEVELOPING", confirmedRequirements: [], segmentSeconds: [{ segmentId: "part-0", seconds: 45 }] })
    expect(bindings[0]!.acceptedDurationSeconds).toBe(2630)
  })

  it("rechecks fresh safety inside the draft mutation lock", async () => {
    await reachCandidates()
    fireEvent.click(within(initialRegion()).getByRole("checkbox"))
    vi.spyOn(flow, "evaluatePlanSafety").mockReturnValue({ kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    fireEvent.click(screen.getByRole("button", { name: applyName }))
    await waitFor(() => expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull())
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBeNull()
    expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
  })

  it.each(["apply", "unmount", "account", "stored"] as const)("guards an in-flight review after %s", async change => {
    const view = await reachCandidates()
    fireEvent.click(within(initialRegion()).getByRole("checkbox"))
    let release!: () => Promise<unknown>
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({ request: (_name, _options, callback) =>
      new Promise(resolve => { release = async () => { const result = await callback({}); resolve(result); return result } }) })
    fireEvent.click(screen.getByRole("button", { name: applyName }))
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "질문 다시 보기" })).toBeDisabled()
    if (change === "unmount") view.unmount()
    if (change === "account") act(() => setActiveLocalAccount("another"))
    if (change === "stored") {
      const source = flow.generatePlanFromDraft(intake, "NO_KNOWN_RISK")
      if (source.kind !== "generated") throw Error("fixture")
      const selected = flow.selectPlanForActivation(source.generated.candidates[0].candidateId,
        source.generated, source.gate, source.intake, source.athleteEvidence)
      if (selected.kind !== "selected") throw Error("fixture")
      expect(store.savePlanBetaState(selected.state).ok).toBe(true)
    }
    const storedBeforeApply = localStorage.getItem(store.activePlanBetaStorageKey())
    await act(async () => { await release() })
    expect(localStorage.getItem(store.activePlanBetaStorageKey())).toBe(storedBeforeApply)
    if (change === "stored") expect(initialRegion()).toBeVisible()
    if (change === "apply") {
      expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull()
      expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    }
  })
})
