import { describe, expect, it } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import { projectInstantToday } from "../screens/plan-beta/instant-plan-today"

// A legacy plan has no saved civil date or IANA zone. The old UTC-date fallback
// has already been used in immutable journal-link identities, so a display fix
// must not silently reinterpret those links as the viewer's current local date.
const generatedAt = "2026-09-06T15:30:00.000Z" // September 7, 00:30 in Seoul.
const linkedAt = "2026-09-07T03:00:00.000Z"

function legacyFixture() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected a V3 plan fixture")
  return { ...state, generatedAt }
}

describe("legacy plan dates and immutable journal links", () => {
  it("keeps an undated plan's existing UTC fallback stable across calendar and journal readers", () => {
    const state = legacyFixture()
    const session = state.activePlan.sessions[0]!
    const draft = createPlannedSessionLogDraft(state, session, linkedAt)

    expect(draft?.date).toBe("2026-09-06")
    expect(draft?.link.plannedDate).toBe("2026-09-06")
    expect(projectInstantToday(state, "2026-09-06").state).toBe("SCHEDULED")
    expect(projectInstantToday(state, "2026-09-07").state).toBe("UNAVAILABLE")
    expect(resolveCurrentPlannedSession(state, draft?.link)).toEqual(session)
  })

  it("uses an explicitly saved civil date without changing an older undated link's identity", () => {
    const old = legacyFixture()
    const explicit = { ...old, intake: { ...old.intake, startDate: "2026-09-07" } }
    const session = old.activePlan.sessions[0]!
    const oldDraft = createPlannedSessionLogDraft(old, session, linkedAt)
    const datedDraft = createPlannedSessionLogDraft(explicit, session, linkedAt)

    expect(datedDraft?.date).toBe("2026-09-07")
    expect(projectInstantToday(explicit, "2026-09-07").state).toBe("SCHEDULED")
    expect(datedDraft?.link.plannedSessionId).not.toBe(oldDraft?.link.plannedSessionId)
    expect(resolveCurrentPlannedSession(explicit, oldDraft?.link)).toBeNull()
    expect(resolveCurrentPlannedSession(old, oldDraft?.link)).toEqual(session)
  })
})
