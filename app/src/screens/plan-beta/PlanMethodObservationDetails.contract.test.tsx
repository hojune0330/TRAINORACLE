import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { collectSessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { SessionExplanationEntry } from "./SessionExplanation"
import { PlanMethodObservationDetails } from "./PlanMethodObservationDetails"
import { COMPARISON_LABELS } from "./PlanCycleEvidence"

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
})
function fixture(overrides: Partial<PostSessionEntry> = {}) {
  const state = stateFixture()
  const session = state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(state, session, state.generatedAt)!
  const entry: PostSessionEntry = { id: "actual-method", kind: "post-session", date: draft.date,
    savedAt: state.generatedAt, syncState: "local", system: "base", title: "", memo: "",
    distanceKm: "3.2", durationMin: "18", avgPace: "5:37", rpe: 4,
    activityOutcome: "PARTIAL", planExecutionRelation: "MODIFIED", plannedSessionLink: draft.link,
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } },
    ...overrides,
  }
  Object.defineProperty(entry, "memo", { get() { throw new Error("memo must not be read") } })
  return { state, session, entry }
}
it("shows exact linked actual measurements in the live explanation reader without memo", async () => {
  const { state, session, entry } = fixture()
  render(<SessionExplanationEntry session={session} context={{ kind: "SAVED", plan: state.activePlan, generatedAt: state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence([entry], state, session)} />)
  await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
  expect(screen.getByText("3.2km")).toBeVisible()
  expect(screen.getByText("18분")).toBeVisible()
  expect(screen.getByText("직접 기록한 RPE 4")).toBeVisible()
  expect(screen.getByText("계획의 일부를 수행한 기록")).toBeVisible()
  expect(screen.getByText("계획을 바꿔 수행한 기록")).toBeVisible()
  expect(screen.getByText(/반복별 기록과 회복 구간은 확인하지 않았어요/u)).toBeVisible()
})
it("suppresses numbers for conflicting linked journals rather than picking one", async () => {
  const { state, session, entry } = fixture()
  const second: PostSessionEntry = { id: "other-result", kind: "post-session", date: entry.date,
    savedAt: entry.savedAt, syncState: "local", system: "base", title: "", memo: "",
    distanceKm: "9", durationMin: "", avgPace: "", rpe: 0,
    plannedSessionLink: entry.plannedSessionLink, fieldProvenance: entry.fieldProvenance }
  render(<SessionExplanationEntry session={session} context={{ kind: "SAVED", plan: state.activePlan, generatedAt: state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence([entry, second], state, session)} />)
  await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
  expect(screen.getByText(/서로 다른 일지가 연결/u)).toBeVisible()
  expect(screen.queryByText("3.2km")).toBeNull()
  expect(screen.queryByText("9km")).toBeNull()
})

it.each(["other-slot", "stale-content"] as const)("does not display a %s method observation from the same generation", async (kind) => {
  const { state, session, entry } = fixture()
  const evidence = collectSessionExplanationEvidence([entry], state, session)!
  const observation = evidence.methodObservation!
  const occurrence = { ...observation.occurrence,
    ...(kind === "other-slot" ? { sessionSlot: "PM" as const } : { sessionContentFingerprint: `sha256:${"0".repeat(64)}` }),
  }
  render(<SessionExplanationEntry session={session} context={{ kind: "SAVED", plan: state.activePlan, generatedAt: state.generatedAt }}
    loadEvidence={() => ({ ...evidence, methodObservation: { ...observation, occurrence } })} />)
  await userEvent.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  await userEvent.click(screen.getByRole("tab", { name: "주기·기록" }))
  expect(screen.queryByText("3.2km")).toBeNull()
  expect(screen.queryByText("직접 기록한 RPE 4")).toBeNull()
  expect(screen.getByText(/조회하지 못한 상태를 일지가 없는 것으로 판단하지 않아요/u)).toBeVisible()
})

it("labels an in-range comparison as RPE only, not distance, time or method adherence", () => {
  const { state, session, entry } = fixture({ activityOutcome: "COMPLETED", planExecutionRelation: "AS_PLANNED" })
  const evidence = collectSessionExplanationEvidence([entry], state, session)!
  const comparison = COMPARISON_LABELS[evidence.rows[0]!.comparison]
  render(<PlanMethodObservationDetails observation={evidence.methodObservation!} comparison={comparison} />)
  expect(screen.getByText("계획 RPE와 비교: 계획 범위 안")).toBeVisible()
  expect(screen.getByText("3.2km")).toBeVisible()
  expect(screen.getByText(/완료 표시만으로 계획의 방법·수치를 그대로 수행했다고 판단하지 않아요/u)).toBeVisible()
})

it.each(["RESTED", "SKIPPED"] as const)("keeps %s without fabricated actual measurements", (outcome) => {
  const { state, session, entry } = fixture({ activityOutcome: outcome, planExecutionRelation: "MODIFIED" })
  const evidence = collectSessionExplanationEvidence([entry], state, session)!
  render(<PlanMethodObservationDetails observation={evidence.methodObservation!} comparison={COMPARISON_LABELS[evidence.rows[0]!.comparison]} />)
  expect(screen.getByText(outcome === "RESTED" ? "휴식으로 기록했어요." : "건너뛴 훈련으로 기록했어요.")).toBeVisible()
  expect(screen.queryByText("3.2km")).toBeNull()
  expect(screen.queryByText("직접 기록한 RPE 4")).toBeNull()
  expect(screen.getAllByText("미기록")).toHaveLength(3)
  expect(screen.getByText(/휴식·건너뜀은 훈련 수행으로 비교하지 않음/u)).toBeVisible()
})

it("distinguishes a missing journal from a linked journal with missing measurements", () => {
  const { state, session, entry } = fixture({ fieldProvenance: {} })
  const missing = collectSessionExplanationEvidence([], state, session)!.methodObservation!
  const view = render(<PlanMethodObservationDetails observation={missing} />)
  expect(screen.getByText(/연결된 일지가 아직 없어요/u)).toBeVisible()
  const linked = collectSessionExplanationEvidence([entry], state, session)!.methodObservation!
  view.rerender(<PlanMethodObservationDetails observation={linked} />)
  expect(screen.queryByText(/연결된 일지가 아직 없어요/u)).toBeNull()
  expect(screen.getAllByText("미기록")).toHaveLength(3)
  expect(screen.getByText("비교할 수 있는 RPE 미기록")).toBeVisible()
})
