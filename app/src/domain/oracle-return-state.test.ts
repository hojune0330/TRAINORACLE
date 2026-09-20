import { beforeEach, describe, expect, it } from "vitest"
import { setAccountAuthState } from "./account/account-auth-state"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import {
  createOracleReturnStore,
  type OracleParticipationAction,
  type OracleReturnScope,
} from "./oracle-return-state"

const TODAY = "2026-09-21"
const fingerprint = "a".repeat(64)
const changedFingerprint = "b".repeat(64)

function store(scope: () => OracleReturnScope = () => ({ kind: "guest" })) {
  return createOracleReturnStore({ storage: window.localStorage, scope, today: () => TODAY })
}

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
  setAccountAuthState("GUEST")
})

describe("oracle return state", () => {
  it("does not write interest, selection, fingerprints, weekdays, or participation before opt-in", () => {
    const current = store()
    expect(current.saveInterest("level")).toEqual({ ok: false, code: "OPT_IN_REQUIRED" })
    expect(current.selectTopic("level")).toEqual({ ok: false, code: "OPT_IN_REQUIRED" })
    expect(current.markTopicSeen("level", fingerprint)).toEqual({ ok: false, code: "OPT_IN_REQUIRED" })
    expect(current.setParticipationWeekdays([1, 3, 5])).toEqual({ ok: false, code: "OPT_IN_REQUIRED" })
    expect(current.recordParticipation("journal-saved", TODAY)).toEqual({ ok: false, code: "OPT_IN_REQUIRED" })
    expect(window.localStorage.length).toBe(0)
  })

  it("stores only explicit interests and last selection after opt-in", () => {
    const current = store()
    expect(current.enableOptIn().ok).toBe(true)
    expect(current.saveInterest("level").ok).toBe(true)
    expect(current.selectTopic("focus").ok).toBe(true)
    expect(current.read().state.savedTopicIds).toEqual(["level"])
    expect(current.read().state.lastSelectedTopicId).toBe("focus")
  })

  it("marks a saved topic unread only after a real fingerprint change", () => {
    const current = store()
    current.enableOptIn()
    current.saveInterest("level")
    expect(current.isTopicUnread("level", fingerprint)).toBe(false)
    current.markTopicSeen("level", fingerprint)
    expect(current.isTopicUnread("level", fingerprint)).toBe(false)
    expect(current.isTopicUnread("level", changedFingerprint)).toBe(true)
    current.markTopicSeen("level", changedFingerprint)
    expect(current.isTopicUnread("level", changedFingerprint)).toBe(false)
    expect(current.isTopicUnread("level", "")).toBe(false)
  })

  it("rejects invalid fingerprints and does not persist source-like values", () => {
    const current = store()
    current.enableOptIn()
    expect(current.markTopicSeen("level", " source memo with health 42 ")).toEqual({ ok: false, code: "INVALID_FINGERPRINT" })
    expect(current.markTopicSeen("level", "")).toEqual({ ok: false, code: "INVALID_FINGERPRINT" })
  })

  it("keeps account scopes separate and re-reads after switching", () => {
    const scopes: { current: OracleReturnScope } = { current: { kind: "account", id: "account-a" } }
    const current = store(() => scopes.current)
    current.enableOptIn()
    current.saveInterest("level")
    scopes.current = { kind: "account", id: "account-b" }
    expect(current.read().state.savedTopicIds).toEqual([])
    current.enableOptIn()
    current.saveInterest("focus")
    scopes.current = { kind: "account", id: "account-a" }
    expect(current.read().state.savedTopicIds).toEqual(["level"])
  })

  it("does not treat an unresolved auth state as guest", () => {
    setAccountAuthState("RESOLVING")
    const current = createOracleReturnStore({
      storage: window.localStorage,
      scope: () => ({ kind: "unresolved" }),
      today: () => TODAY,
    })
    expect(current.read().status).toBe("unresolved")
    expect(current.enableOptIn()).toEqual({ ok: false, code: "SCOPE_UNAVAILABLE" })
  })

  it("accepts only the three meaningful actions and deduplicates one local date", () => {
    const current = store()
    current.enableOptIn()
    current.setParticipationWeekdays([1, 3, 5])
    const actions: OracleParticipationAction[] = ["journal-saved", "plan-reviewed", "rest-recorded"]
    for (const action of actions) expect(current.recordParticipation(action, "2026-09-21")).not.toEqual({ ok: true })
    expect(current.recordParticipation("journal-saved", "2026-09-18").ok).toBe(true)
    expect(current.recordParticipation("plan-reviewed", "2026-09-18")).toEqual({ ok: false, code: "ALREADY_RECORDED" })
    expect(current.recordParticipation("open" as never, TODAY)).toEqual({ ok: false, code: "INVALID_ACTION" })
    expect(current.getParticipationSummary(TODAY).cumulative).toBe(2)
  })

  it("rejects future and malformed dates", () => {
    const current = store()
    current.enableOptIn()
    current.setParticipationWeekdays([1])
    expect(current.recordParticipation("rest-recorded", "2026-09-22")).toEqual({ ok: false, code: "FUTURE_DATE" })
    expect(current.recordParticipation("rest-recorded", "2026-02-30")).toEqual({ ok: false, code: "INVALID_DATE" })
  })

  it("keeps cumulative dates after a rest day while streak follows selected weekdays", () => {
    const current = store()
    current.enableOptIn()
    current.setParticipationWeekdays([1, 3, 5])
    current.recordParticipation("journal-saved", "2026-09-14")
    current.recordParticipation("rest-recorded", "2026-09-16")
    current.recordParticipation("plan-reviewed", "2026-09-18")
    expect(current.getParticipationSummary(TODAY)).toMatchObject({ cumulative: 3, streak: 3 })
    expect(current.recordParticipation("rest-recorded", "2026-09-20").ok).toBe(true)
    expect(current.getParticipationSummary(TODAY).cumulative).toBe(4)
  })

  it("does not fail today before its selected slot ends, but fails after a missed prior slot", () => {
    const current = store()
    current.enableOptIn()
    current.setParticipationWeekdays([1, 3, 5])
    current.recordParticipation("journal-saved", "2026-09-14")
    current.recordParticipation("journal-saved", "2026-09-16")
    current.recordParticipation("journal-saved", "2026-09-18")
    // 2026-09-21 is Monday: today's unrecorded slot is not a failure yet.
    expect(current.getParticipationSummary("2026-09-21").streak).toBe(3)

    const missed = store(() => ({ kind: "account", id: "missed" }))
    missed.enableOptIn()
    missed.setParticipationWeekdays([1, 3, 5])
    missed.recordParticipation("journal-saved", "2026-09-14")
    // The most recent selected slot before today (Friday) is missing.
    expect(missed.getParticipationSummary("2026-09-21").streak).toBe(0)
  })

  it("fails closed when persisted state is corrupted", () => {
    const current = store()
    current.enableOptIn()
    const key = [...Object.keys(window.localStorage)][0]
    if (key === undefined) throw new Error("expected opt-in state key")
    window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, optedIn: true, savedTopicIds: ["not-a-topic"] }))
    expect(current.read().status).toBe("corrupt")
    expect(current.saveInterest("level")).toEqual({ ok: false, code: "INVALID_STORAGE" })
  })
})
