import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { collectSessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import type { PostSessionEntry } from "../../domain/journal-schema"
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
})
function fixture() {
  const state = stateFixture()
  const session = state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(state, session, state.generatedAt)!
  const entry: PostSessionEntry = { id: "actual-method", kind: "post-session", date: draft.date,
    savedAt: state.generatedAt, syncState: "local", system: "base", title: "", memo: "",
    distanceKm: "3.2", durationMin: "18", avgPace: "5:37", rpe: 4,
    activityOutcome: "PARTIAL", planExecutionRelation: "MODIFIED", plannedSessionLink: draft.link,
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } },
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
