import { beforeEach, describe, expect, it } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import {
  createPlannedSessionLogDraft,
  plannedSessionLinkSchema,
} from "./planned-session-link"
import { loadEntries, saveEntry, updateEntry } from "./journal-store"

const LINKED_AT = "2026-08-28T03:00:00.000Z"

function linkedDraft() {
  const state = stateFixture()
  const session = state.activePlan.sessions[0]
  if (session === undefined) throw new Error("Missing fixture session")
  const draft = createPlannedSessionLogDraft(state, session, LINKED_AT)
  if (draft === null) throw new Error("Failed to create planned-session draft")
  return { state, session, draft }
}

function entry(id: string, savedAt: string) {
  const { draft } = linkedDraft()
  return {
    id,
    kind: "post-session" as const,
    date: draft.date,
    savedAt,
    syncState: "local" as const,
    system: "",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "",
    plannedSessionLink: draft.link,
  }
}

describe("immutable planned-session journal linkage", () => {
  beforeEach(() => window.localStorage.clear())

  it("derives an opaque stable session id from the accepted plan occurrence", () => {
    const first = linkedDraft().draft
    const state = stateFixture()
    const session = state.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const laterClick = createPlannedSessionLogDraft(state, session, "2026-08-28T04:00:00.000Z")

    expect(laterClick?.link.plannedSessionId).toBe(first.link.plannedSessionId)
    expect(first.link.plannedSessionId).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(JSON.stringify(first.link)).not.toContain(state.activePlan.candidateId)
    expect(first.date).toBe("2026-07-24")
  })

  it("rejects identity tampering and sessions that are not in the stored plan", () => {
    const { state, session, draft } = linkedDraft()
    expect(plannedSessionLinkSchema.safeParse({
      ...draft.link,
      sessionDay: draft.link.sessionDay + 1,
    }).success).toBe(false)
    expect(plannedSessionLinkSchema.safeParse({
      ...draft.link,
      plannedEnergyIntent: "VO2_INTENT",
    }).success).toBe(false)
    expect(plannedSessionLinkSchema.safeParse({
      ...draft.link,
      candidateFingerprint: `sha256:${"f".repeat(64)}`,
    }).success).toBe(false)
    expect(createPlannedSessionLogDraft(state, { ...session, day: 2 }, LINKED_AT)).toBeNull()
  })

  it("allows only one visible journal result per planned session", () => {
    expect(saveEntry(entry("linked-1", "2026-08-28T03:00:00.000Z")).ok).toBe(true)
    expect(saveEntry(entry("linked-2", "2026-08-28T03:01:00.000Z")).ok).toBe(false)
    expect(loadEntries()).toHaveLength(1)
  })

  it("does not allow an edit to add, remove, or replace the immutable plan link", () => {
    const original = entry("linked-edit", "2026-08-28T03:00:00.000Z")
    expect(saveEntry(original).ok).toBe(true)

    const withoutLink = { ...original, savedAt: "2026-08-28T03:01:00.000Z" }
    delete (withoutLink as { plannedSessionLink?: unknown }).plannedSessionLink
    expect(updateEntry(withoutLink, original.savedAt).ok).toBe(false)

    expect(updateEntry({
      ...original,
      title: "실제로 한 훈련",
      savedAt: "2026-08-28T03:02:00.000Z",
    }, original.savedAt).ok).toBe(true)
    const saved = loadEntries()[0]
    expect(saved?.kind === "post-session" ? saved.plannedSessionLink : undefined)
      .toEqual(original.plannedSessionLink)
  })
})
