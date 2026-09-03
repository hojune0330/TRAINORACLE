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

describe("session explanation review regressions", () => {
  it("does not turn unspecified QUALITY intervals into one repetition and zero recovery", async () => {
    const session: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT", prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 30, maximum: 40 }, rpe: { minimum: 6, maximum: 7 } } }
    render(<SessionExplanationEntry session={session} />)
    await userEvent.click(screen.getByRole("button", { name: "이 훈련을 하는 이유" }))
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
    await userEvent.click(screen.getByRole("button", { name: "이 훈련을 하는 이유" }))
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
    await userEvent.click(screen.getByRole("button", { name: "이 훈련을 하는 이유" }))
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
