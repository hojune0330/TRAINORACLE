import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import React from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import * as store from "../domain/plan-beta-store"
import * as initialMain from "../domain/initial-main-conditions"
import * as selection from "./plan-beta/plan-selection"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

vi.mock("../domain/account/plan-cloud-backup", () => ({ planCloudBackupEnabled: () => false,
  backupActivePlanToServer: async () => ({ kind: "unavailable" }), loadLatestPlanFromServer: async () => ({ kind: "unavailable" }) }))
vi.mock("../domain/account/supabase-client", () => ({ supabase: async () => null }))

const intake: store.PlanBetaIntake = { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
  experienceBand: "NEW_TO_RUNNING", availableDayCount: "EVERY_DAY", requestedFrameLength: 9, trainingFocus: "ATP_PC_INTENT",
  secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture(); setActiveLocalAccount(null)
  vi.spyOn(store, "loadPreviousIntake").mockReturnValue(intake)
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic fixture forbids network") }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })

async function reachCandidates() {
  render(<PlanBeta />)
  fireEvent.click(await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await screen.findByRole("heading", { name: "계획이 준비됐어요" })
  // New drafts must complete each unresolved MAIN before activation. The
  // cancellation tests start from that explicitly reviewed, still-unsaved draft.
  expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
  expect(store.loadPlanBetaState()).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "필요한 항목 확인" }))
  const review = within(screen.getByRole("region", { name: "첫 주요 훈련 조건" }))
  fireEvent.click(review.getByRole("checkbox"))
  fireEvent.click(review.getByRole("button", { name: "이 훈련으로 적용" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled())
}

function openScheduleQuestion(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "일정·운동 시간" }))
  fireEvent.click(screen.getByRole("button", { name }))
}

describe("canceling a plan refinement question", () => {
  it.each(["frame", "race"] as const)("preserves the applied MAIN and its confirmation when canceling %s without a new answer", async question => {
    const applied = vi.spyOn(initialMain, "applyInitialMainConditions")
    await reachCandidates()
    const expected = applied.mock.results[0]?.value?.generated.candidates[0].sessions
    expect(expected).toBeDefined()

    openScheduleQuestion(question === "frame" ? /^달력 길이 바꾸기/u : /^대회 날짜 바꾸기/u)
    if (question === "race") fireEvent.change(screen.getByLabelText("목표 경기 날짜"), { target: { value: "2099-08-23" } })
    fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(store.loadPlanBetaState()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    expect(store.loadPlanBetaState()!.activePlan.sessions).toEqual(expected)
  }, 20_000)

  it("discards an unconfirmed race date and returns to the startable original result", async () => {
    await reachCandidates()
    openScheduleQuestion(/^대회 날짜 바꾸기/u)
    fireEvent.change(screen.getByLabelText("목표 경기 날짜"), { target: { value: "2099-08-23" } })
    fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
    expect(screen.queryByRole("heading", { name: "아직 경기 날짜를 계획에 적용할 수 없어요" })).toBeNull()
    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(store.loadPlanBetaState()).toBeNull()
    openScheduleQuestion(/^대회 날짜 바꾸기/u)
    expect(screen.getByLabelText("목표 경기 날짜")).toHaveValue("")
    fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    expect(store.loadPlanBetaState()!.intake).toMatchObject(intake)
    expect(store.loadPlanBetaState()!.intake).not.toHaveProperty("targetRaceDate")
  }, 20_000)

  it("preserves the selected B plan when canceling a refinement and saves B", async () => {
    const saveOriginal = selection.saveSelectedPlanCandidate
    const save = vi.spyOn(selection, "saveSelectedPlanCandidate").mockImplementation((...args) => saveOriginal(...args))
    await reachCandidates()
    fireEvent.click(screen.getByText("다른 계획 보기", { selector: "summary" }))
    fireEvent.click(screen.getByRole("button", { name: "B안 선택" }))
    expect(screen.getByRole("button", { name: "B안 선택됨" })).toHaveAttribute("aria-pressed", "true")

    openScheduleQuestion(/^달력 길이 바꾸기/u)
    fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
    expect(screen.getByRole("button", { name: "B안 선택됨" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))

    const saveCall = save.mock.calls[0]
    if (saveCall === undefined) throw Error("Expected the selected B plan to be saved")
    const [savedSelection, generated] = saveCall
    const savedCandidate = generated.candidates.find(candidate => candidate.candidateId === savedSelection.candidateId)
    expect(savedCandidate?.kind).toBe("CONSERVATIVE")
    expect(store.loadPlanBetaState()!.activePlan.sessions).toEqual(savedCandidate?.sessions)
  }, 20_000)

  it("still opens the date preview after the user explicitly confirms the new date", async () => {
    await reachCandidates()
    openScheduleQuestion(/^대회 날짜 바꾸기/u)
    fireEvent.change(screen.getByLabelText("목표 경기 날짜"), { target: { value: "2099-08-23" } })
    fireEvent.click(screen.getByRole("button", { name: "이 날짜로 배치 미리보기" }))
    expect(screen.getByRole("heading", { name: "아직 경기 날짜를 계획에 적용할 수 없어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
    expect(store.loadPlanBetaState()).toBeNull()
  }, 20_000)

  it("restores the failed save and its exact retry selection after canceling a question", async () => {
    const save = vi.spyOn(selection, "saveSelectedPlanCandidate").mockResolvedValueOnce({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
    await reachCandidates()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    await screen.findByRole("button", { name: "저장 다시 시도" })
    const failedCall = save.mock.calls[0]
    if (failedCall === undefined) throw Error("Expected the initial save attempt")
    const failedSelection = failedCall[0]
    openScheduleQuestion(/^달력 길이 바꾸기/u)
    fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }))
    await waitFor(() => expect(store.readPlanBetaStateFromStorage().kind).toBe("loaded"))
    expect(save).toHaveBeenCalledTimes(2)
    const retryCall = save.mock.calls[1]
    if (retryCall === undefined) throw Error("Expected the retry save attempt")
    expect(retryCall[0]).toEqual(failedSelection)
  }, 20_000)

  it("keeps the unsaved-plan navigation guard while its unchanged question is open", async () => {
    await reachCandidates()
    openScheduleQuestion(/^달력 길이 바꾸기/u)
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(store.loadPlanBetaState()).toBeNull()
  }, 20_000)
})
