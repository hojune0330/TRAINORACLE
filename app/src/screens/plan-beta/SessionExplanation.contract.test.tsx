import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { collectSessionExplanationEvidence, type SessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { FIELD_PROVENANCE } from "../../domain/field-provenance"
import { SessionExplanationEntry } from "./SessionExplanation"
import { sessionExecutionSteps } from "./labels"

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo")
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup()
  for (const [prototype, key, descriptor] of [[HTMLDialogElement.prototype, "showModal", originalShowModal], [Element.prototype, "scrollTo", originalScrollTo]] as const) {
    if (descriptor) Object.defineProperty(prototype, key, descriptor)
    else Reflect.deleteProperty(prototype, key)
  }
  vi.restoreAllMocks()
})

function scope(candidateId: string, generatedAt: string, rpe: number): SessionExplanationEvidence {
  return { candidateId, generatedAt, sessionId: `${candidateId}:${generatedAt}`, rows: [{ plannedSessionId: `${candidateId}:${generatedAt}`, date: generatedAt.slice(0, 10), day: 1, slot: "AM", role: "EASY", actualRpe: rpe, plannedRpe: { minimum: 2, maximum: 4 }, comparison: "WITHIN_RANGE" }] }
}

function paceSession(): PlanSession {
  return {
    day: 5,
    slot: "PM",
    role: "QUALITY",
    plannedEnergyIntent: "VO2_INTENT",
    prescription: {
      kind: "PACE_TARGET",
      notation: '5×1000m @5000m RP r150" JOG',
      templateId: "V2-SEED-05",
      templateVersion: "1.0.0",
      templateContentFingerprint: "sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a",
      setCount: 1,
      repetitionsPerSet: 5,
      repetitionDistanceM: 1000,
      targetEventDistanceM: 5000,
      targetRepSeconds: 222,
      selectedAnchor: { anchorId: "synthetic-record", kind: "RECENT_RESULT", purpose: "CURRENT_CAPABILITY", eventDistanceM: 5000, performanceSeconds: 1110, achievedAt: "2026-09-01", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", freshnessState: "CURRENT", sourceRef: "athlete-record:synthetic-record", elapsedLabel: "2일 전" },
      displayRoundingPolicyVersion: "seconds-v1",
      repetitionRecoverySeconds: 150,
      repetitionRecoveryMode: "JOG",
      setRecoverySeconds: null,
      setRecoveryMode: "NOT_APPLICABLE",
      totals: { totalRepetitions: 5, qualityDistanceM: 5000, qualityDurationSeconds: null, repetitionRecoveryOccurrences: 4, repetitionRecoveryTotalSeconds: 600, setRecoveryOccurrences: 0, setRecoveryTotalSeconds: 0, plannedRecoverySeconds: 600, mainSessionTotalExcludingWarmupCooldown: null, uncomputableReasonCodes: ["WORK_DURATION_UNAVAILABLE"] },
      stopCodes: ["STOP_NEW_OR_WORSENING_PAIN", "STOP_DIZZINESS_OR_FAINTNESS", "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING", "STOP_LOSS_OF_CONTROLLED_FORM"],
      operationalComponents: {
        warmup: { easyDurationMinutes: 15, rpeMin: 2, rpeMax: 3, strides: { repetitions: 4, durationSeconds: 20, recoverySeconds: 40 } },
        cooldown: { easyDurationMinutes: 10, rpeMin: 1, rpeMax: 2 },
      },
    },
  } as unknown as PlanSession
}

describe("session explanation review regressions", () => {
  it.each(["LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT"] as const)("preserves %s performance and stopping guidance within one RPE flow", async (intent) => {
    const session: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: intent, prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 30, maximum: 40 }, rpe: { minimum: 6, maximum: 7 } } }
    render(<SessionExplanationEntry session={session} />)
    await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
    const reader = screen.getByRole("dialog")
    const flow = reader.querySelector(".session-explanation__sequence")!
    expect(reader.querySelectorAll(".session-explanation__sequence")).toHaveLength(1)
    expect(flow.children).toHaveLength(3)
    for (const step of sessionExecutionSteps(session)) expect(flow).toHaveTextContent(step.detail.replace(/\s+/gu, " "))
    expect(flow).toHaveTextContent("세션 시간 안내 (구간 미지정)")
    expect(flow).toHaveTextContent("반복 길이·횟수와 회복 초수는 이 계획에 저장되지 않았어요.")
    expect(reader.querySelector(".prescription-structure")).toBeNull()
  })

  it("leads a detailed prescription with its selected-record recommendation and one complete performance order", async () => {
    render(<SessionExplanationEntry session={paceSession()} />)
    await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))

    const reader = screen.getByRole("dialog")
    expect(screen.getByRole("heading", { name: "수행 순서" })).toBeVisible()
    expect(screen.getByText(/준비, 5회 본운동과 4번의 사이 회복, 정리 순서/u)).toBeVisible()
    expect(screen.getByText("개인 추천 시간")).toBeVisible()
    expect(screen.getByText(/1000m당 약 3분 42초.*5000m 18분 30초 기준/u)).toBeVisible()
    expect(screen.getByText("추천 기준")).toBeVisible()
    expect(reader.querySelectorAll(".plan-detailed-prescription__notation")).toHaveLength(1)
    expect(reader.querySelector(".plan-detailed-prescription__notation code")).toHaveTextContent('5×1000m @5000m RP r150" JOG')
    expect(reader).not.toHaveTextContent("오늘 할 훈련")
    expect(reader).toHaveTextContent("준비")
    expect(reader).toHaveTextContent("반복 사이: 150초 가벼운 조깅 · 4번")
    expect(reader).toHaveTextContent("정리")

    const recommendation = reader.querySelector(".plan-detailed-prescription--sequence-lead")
    const structure = reader.querySelector(".prescription-structure")
    expect(recommendation).not.toBeNull()
    expect(structure).not.toBeNull()
    expect(recommendation!.compareDocumentPosition(structure!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("does not turn unspecified QUALITY intervals into one repetition and zero recovery", async () => {
    const session: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT", prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 30, maximum: 40 }, rpe: { minimum: 6, maximum: 7 } } }
    render(<SessionExplanationEntry session={session} />)
    await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
    expect(screen.getByText("세션 시간 안내 (구간 미지정)")).toBeVisible()
    expect(document.querySelector(".prescription-structure")).toBeNull()
    expect(screen.getByRole("dialog").textContent).not.toMatch(/운동 구간 · 1회|본운동에 연결된 회복: 0초/u)
  })

  it("refreshes exact generation evidence without keeping the previous RPE", async () => {
    const state = stateFixture()
    const session = state.activePlan.sessions[0]!
    const context = { plan: state.activePlan, kind: "SAVED" as const, generatedAt: state.generatedAt }
    const current = scope(state.activePlan.candidateId, state.generatedAt, 3)
    const view = render(<SessionExplanationEntry session={session} context={context} loadEvidence={() => current} />)
    await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
    await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
    expect(screen.getByText("직접 기록한 RPE 3")).toBeVisible()
    const nextContext = { ...context, generatedAt: "2026-09-02T00:00:00.000Z" }
    const next = scope(state.activePlan.candidateId, nextContext.generatedAt, 6)
    view.rerender(<SessionExplanationEntry session={session} context={nextContext} loadEvidence={() => next} />)
    expect(screen.queryByText("직접 기록한 RPE 3")).toBeNull()
    expect(screen.getByText("직접 기록한 RPE 6")).toBeVisible()
    view.rerender(<SessionExplanationEntry session={session} context={nextContext} loadEvidence={() => current} />)
    expect(screen.queryByText("직접 기록한 RPE 3")).toBeNull()
    expect(screen.getByText(/조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요/u)).toBeVisible()
  })

  it.each(["absent", "failed"] as const)("distinguishes %s evidence access from zero linked journals", async (kind) => {
    const state = stateFixture()
    render(<SessionExplanationEntry session={state.activePlan.sessions[0]!} loadEvidence={kind === "absent" ? undefined : () => { throw new Error("unavailable") }} />)
    await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
    await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
    expect(screen.getByText(/조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요/u)).toBeVisible()
    expect(screen.queryByText(/연결된 일지가 아직 없어요/u)).toBeNull()
  })

  it("collects the exact plan occurrence and never reads raw memo", () => {
    const state = stateFixture()
    const session = state.activePlan.sessions[0]!
    const draft = createPlannedSessionLogDraft(state, session, state.generatedAt)!
    const entry: PostSessionEntry = { id: "synthetic-journal", kind: "post-session", date: draft.date, savedAt: state.generatedAt, syncState: "local", system: "base", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 3, memo: "", fieldProvenance: { rpe: { provenance: FIELD_PROVENANCE.explicit } }, plannedSessionLink: draft.link }
    Object.defineProperty(entry, "memo", { get: () => { throw new Error("raw memo read") } })
    expect(collectSessionExplanationEvidence([entry], state, session)?.rows[0]?.actualRpe).toBe(3)
    const next = { ...state, generatedAt: "2026-09-02T00:00:00.000Z" }
    expect(collectSessionExplanationEvidence([entry], next, session)?.rows).toEqual([])
    expect(collectSessionExplanationEvidence([entry], state, { ...session, slot: "PM" })).toBeNull()
  })
})
