import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { JournalOriginalPlan } from "./JournalOriginalPlan"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import type { RetainedAdjustedPlanEvidence } from "../../domain/adjusted-plan-selection"
import { saveSelectedAdjustedPlan } from "../../domain/adjusted-plan-store"
import { activePlanBetaStorageKey } from "../../domain/plan-beta-store"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { saveEntry, loadEntries } from "../../domain/journal-store"
import { MEMO_PURPOSE } from "../../domain/journal-schema"
import type { PostSessionEntry } from "../../domain/journal-schema"

const context = vi.hoisted(() => ({ retained: [] as readonly RetainedAdjustedPlanEvidence[] }))
vi.mock("../../domain/journal-original-plan", async importOriginal => {
  const original = await importOriginal<typeof import("../../domain/journal-original-plan")>()
  return { ...original, readJournalOriginalPlan: (entry: PostSessionEntry) => original.readJournalOriginalPlan(entry, context.retained) }
})
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); context.retained = [] })

async function savedEntry() {
  const { request, review, retained } = adjustedPlanSelectionFixture()
  context.retained = retained
  const saved = await saveSelectedAdjustedPlan({ request, readReview: () => review, isCurrentDraft: () => true,
    locks: { request: async (_n, _o, callback) => callback({}) } })
  if (saved.kind !== "saved") throw Error(saved.code)
  const selection = saved.state.selection
  const session = selection.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  const draft = createPlannedSessionLogDraft(selection, session, TODAY.toISOString())!
  const entry: PostSessionEntry = { id: "synthetic-adjusted-original", kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", activitySlot: session.slot, plannedSessionLink: draft.link,
    system: "", title: "", memo: "DO-NOT-DISPLAY-RAW-NOTE", memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  if (!saveEntry(entry).ok) throw Error("Expected real journal write")
  const loaded = loadEntries().find(item => item.id === entry.id)
  if (loaded?.kind !== "post-session") throw Error("Expected journal reload")
  return loaded
}
function expand() {
  const details = screen.getByText("계획한 훈련과 비교하기").closest("details")!
  act(() => { details.open = true; fireEvent(details, new Event("toggle")) })
  return details
}

it("opens the saved adjusted structure and reasons from the journal, not original flat values", async () => {
  const entry = await savedEntry()
  vi.setSystemTime(new Date(TODAY.getTime() + 1000))
  const before = Object.entries(localStorage)
  render(<JournalOriginalPlan entry={entry} />)
  expect(screen.queryByText(/400m당 약/)).toBeNull()
  expand()
  expect(screen.getByText(/400m당 약/)).toBeVisible()
  expect(screen.getByText(/본운동 거리: 800m/)).toBeVisible()
  expect(screen.getByText(/반복 사이: 17초/)).toBeVisible()
  const reason = screen.getByText("이렇게 구성한 이유").closest("details")!
  act(() => { reason.open = true; fireEvent(reason, new Event("toggle")) })
  expect(screen.getByText("TEST work")).toBeVisible()
  expect(screen.getByText("TEST recovery")).toBeVisible()
  expect(screen.queryByText("DO-NOT-DISPLAY-RAW-NOTE")).toBeNull()
  expect(Object.entries(localStorage)).toEqual(before)
  act(() => { setActiveLocalAccount("different-owner") })
  expect(screen.queryByText(/400m당 약/)).toBeNull()
})

it("does not display unverified adjusted bytes as the original training", async () => {
  const entry = await savedEntry()
  localStorage.setItem(activePlanBetaStorageKey(), "{broken")
  render(<JournalOriginalPlan entry={entry} />)
  expand()
  expect(screen.getByText(/연결된 계획을 읽지 못했어요/)).toBeVisible()
  expect(screen.queryByText(/400m당 약/)).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe("{broken")
})
