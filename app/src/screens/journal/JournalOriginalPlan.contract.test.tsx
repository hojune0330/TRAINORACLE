import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { JournalOriginalPlan } from "./JournalOriginalPlan"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { archiveAndClearActivePlan, savePlanBetaState } from "../../domain/plan-beta-store"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import type { PostSessionEntry } from "../../domain/journal-schema"

vi.mock("../plan-beta/SessionExplanation", () => ({ SessionExplanationEntry: ({ context }: { context: { generatedAt: string } }) =>
  <button type="button">원본 상세 {context.generatedAt}</button> }))

const plan = stateFixture()
const draft = createPlannedSessionLogDraft(plan, plan.activePlan.sessions[0]!, plan.generatedAt)!
const entry: PostSessionEntry = { id: "synthetic-linked", kind: "post-session", date: draft.date, savedAt: plan.generatedAt,
  syncState: "local", plannedSessionLink: draft.link, activitySlot: "AM", system: "", title: "", memo: "SECRET-NOT-FOR-EXPLANATION",
  distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); setActiveLocalAccount(null) })
async function open() {
  const details = screen.getByText("계획한 훈련과 비교하기").closest("details")!
  act(() => { details.open = true; fireEvent(details, new Event("toggle")) })
  await waitFor(() => expect(details.open).toBe(true))
  return details
}

it("shows the archived original only after expansion, with no memo or new plan creation", async () => {
  expect(archiveAndClearActivePlan(plan).ok).toBe(true)
  const before = Object.entries(localStorage)
  render(<JournalOriginalPlan entry={entry} />)
  expect(screen.queryByRole("button", { name: /원본 상세/u })).toBeNull()
  await open()
  await screen.findByText(/그때 보관한 계획/u)
  expect(screen.getByRole("button", { name: `원본 상세 ${plan.generatedAt}` })).toBeVisible()
  expect(screen.queryByText("SECRET-NOT-FOR-EXPLANATION")).toBeNull()
  expect(Object.entries(localStorage)).toEqual(before)
})

it("does not replace an unavailable old occurrence with the current plan", async () => {
  const next = { ...plan, generatedAt: "2026-08-01T00:00:00Z" }
  expect(savePlanBetaState(next).ok).toBe(true)
  expect(readJournalOriginalPlan(entry).kind).toBe("missing")
  render(<JournalOriginalPlan entry={entry} />)
  await open()
  await screen.findByText(/계획 원본을 찾지 못했어요/u)
  expect(screen.queryByRole("button", { name: /원본 상세/u })).toBeNull()
})

it("distinguishes damaged history from a missing original", async () => {
  localStorage.setItem("trainoracle.plan-beta.history.v1", "{broken")
  render(<JournalOriginalPlan entry={entry} />)
  await open()
  await screen.findByText(/계획을 읽지 못했어요/u)
  expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBe("{broken")
})

it("does not label an unreadable current plan as an absent original", async () => {
  localStorage.setItem("trainoracle.plan-beta.v1", "{broken")
  render(<JournalOriginalPlan entry={entry} />)
  await open()
  await screen.findByText(/계획을 읽지 못했어요/u)
  expect(screen.queryByText(/계획 원본을 찾지 못했어요/u)).toBeNull()
  expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe("{broken")
})

it("unmounts the original explanation on account changes", async () => {
  expect(archiveAndClearActivePlan(plan).ok).toBe(true)
  render(<JournalOriginalPlan entry={entry} />)
  const details = await open()
  await screen.findByRole("button", { name: /원본 상세/u })
  act(() => { setActiveLocalAccount("other-account") })
  expect(details.open).toBe(false)
  expect(screen.queryByRole("button", { name: /원본 상세/u })).toBeNull()
})

it("does not add a control to an unlinked journal", () => {
  const { plannedSessionLink: _link, ...unlinked } = entry
  render(<JournalOriginalPlan entry={unlinked} />)
  expect(screen.queryByText("계획한 훈련과 비교하기")).toBeNull()
})

it("closes the previous original when the displayed journal link changes", async () => {
  expect(archiveAndClearActivePlan(plan).ok).toBe(true)
  const view = render(<JournalOriginalPlan entry={entry} />)
  const details = await open()
  await screen.findByRole("button", { name: /원본 상세/u })
  view.rerender(<JournalOriginalPlan entry={{ ...entry, date: "2026-08-02" }} />)
  expect(details.open).toBe(false)
  expect(screen.queryByRole("button", { name: /원본 상세/u })).toBeNull()
  await open()
  await screen.findByText(/계획을 읽지 못했어요/u)
})
