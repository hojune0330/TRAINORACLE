import { createElement } from "react"
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { AthleteRecord } from "../athlete-records"
import type { AccountAthleteRecordsState, AccountAthleteRecordsStatus } from "./account-athlete-record-service"
import { ACCOUNT_ATHLETE_RECORD_EVENT, readAccountAthleteRecordsState } from "./account-athlete-record-service"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { accountScopedStorageKeyFor } from "./local-account-scope"
import { ATHLETE_RECORDS_STORAGE_KEY } from "../athlete-records"
import { areCatalogPaceSourcesCurrent, eligibleAccountPaceRecords, isEligiblePaceRecordCurrent, readEligibleAccountPaceRecords } from "./eligible-account-pace-records"
import { useEligibleAccountPaceRecords } from "../../hooks/useEligibleAccountPaceRecords"
import { createSegmentRecordReference } from "../catalog-pace-reference"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { prepareInitialRecordPaces } from "../initial-record-pace"
import { InitialRecordPaceOffer } from "../../screens/plan-beta/InitialRecordPaceOffer"
import { generatePlanFromDraft } from "../plan-beta-flow"

vi.mock("./account-athlete-record-service", () => ({
  ACCOUNT_ATHLETE_RECORD_EVENT: "test:account-records", readAccountAthleteRecordsState: vi.fn(),
}))
vi.mock("../initial-record-pace", () => ({ prepareInitialRecordPaces: vi.fn() }))

const A = "account-a", B = "account-b"
const record = (id: string, overrides: Partial<AthleteRecord> = {}): AthleteRecord => ({
  schemaVersion: 1, id, purpose: "RECENT_RESULT", eventDistanceM: 5000,
  performanceSeconds: 1000, achievedOn: "2026-10-01", seasonId: null, enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED", sourceRef: `athlete-record:${id}`, savedAt: "2026-10-02T00:00:00.000Z",
  ...overrides,
} as AthleteRecord)
const server = record("server"), device = record("device"), stale = record("server", { performanceSeconds: 900 })
let state: AccountAthleteRecordsState
// Exercise source authority with a real draft; only the pace transformation is stubbed.
const generated = (() => {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY",
    requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null, startDate: "2026-10-02" }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error("Expected valid source-authority draft")
  return result.generated
})()
const preview = { synthetic: "preview" } as unknown as PlanGenerationSuccess
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-02T03:00:00.000Z"))
  localStorage.clear()
  setActiveLocalAccount(A)
  state = { ownerId: A, status: "READY", confirmed: true, documentId: "document-a", serverRevision: 1, records: [server] }
  vi.mocked(readAccountAthleteRecordsState).mockImplementation(() => state)
  vi.mocked(prepareInitialRecordPaces).mockImplementation((_draft, records) => {
    const actual = records.find(row => row.purpose !== "RACE_GOAL")
    return actual ? { record: actual, records: [actual], generated: preview,
      changed: [{ day: 1, slot: "AM" }], longerDuration: false, durationChanges: [] } : null
  })
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.useRealTimers(); vi.restoreAllMocks() })

describe("authoritative pace-record source", () => {
  it("uses server values, not stale same-ID cache or device-only extras", () => {
    expect(eligibleAccountPaceRecords([stale, device], A, state)).toEqual([server])
    expect(readEligibleAccountPaceRecords([stale, device])).toEqual([server])
  })
  it.each<AccountAthleteRecordsStatus>(["IDLE", "AUTH_REQUIRED", "LOADING", "EMPTY", "PENDING", "CONFLICT", "DELETED", "FAILED"])(
    "blocks %s even with retained records and a mistakenly true confirmed flag", status => {
      state = { ...state, status }
      expect(readEligibleAccountPaceRecords([device])).toEqual([])
    })
  it("blocks READY without confirmation", () => {
    state.confirmed = false
    expect(readEligibleAccountPaceRecords([device])).toEqual([])
  })
  it("blocks a previous owner's confirmed response", () => {
    state.ownerId = B
    expect(readEligibleAccountPaceRecords([device])).toEqual([])
  })
  it("retains goals as explicit options but excludes unverified and duplicate IDs", () => {
    const goal = record("goal", { purpose: "RACE_GOAL", achievedOn: null })
    state.records = [server, goal, record("unverified", { verificationState: "UNVERIFIED" }),
      record("duplicate"), record("duplicate", { performanceSeconds: 950 })]
    expect(readEligibleAccountPaceRecords([device])).toEqual([server, goal])
  })
  it("uses guest device input without borrowing a signed-in server snapshot", () => {
    setActiveLocalAccount(null)
    expect(readEligibleAccountPaceRecords([device])).toEqual([device])
    localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([device]))
    expect(readEligibleAccountPaceRecords()).toEqual([device])
  })
  it("never changes or deletes guest or account cache on deletion", () => {
    const key = accountScopedStorageKeyFor(ATHLETE_RECORDS_STORAGE_KEY, A)
    localStorage.setItem(key, JSON.stringify([stale, device]))
    localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([device]))
    const before = JSON.stringify(Object.entries(localStorage))
    state = { ...state, status: "DELETED", confirmed: false, records: [] }
    const write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem")
    expect(readEligibleAccountPaceRecords()).toEqual([])
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(JSON.stringify(Object.entries(localStorage))).toBe(before)
  })
})

describe("initial offer render and click source rechecks", () => {
  function show() {
    const onChange = vi.fn()
    const view = render(createElement(InitialRecordPaceOffer, { generated, records: [device, stale], disabled: false, onChange }))
    return { ...view, onChange }
  }
  it("offers the confirmed server source and applies only a draft on explicit click", () => {
    const { onChange } = show()
    expect(prepareInitialRecordPaces).toHaveBeenLastCalledWith(generated, [server], expect.any(String), undefined)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button"))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(preview)
  })
  it.each<AccountAthleteRecordsStatus>(["DELETED", "PENDING", "CONFLICT", "FAILED", "LOADING"])(
    "rechecks %s at click even before a state event causes a rerender", status => {
      const { onChange } = show()
      state = { ...state, status, confirmed: false }
      fireEvent.click(screen.getByRole("button"))
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.queryByRole("button")).toBeNull()
    })
  it("rejects a changed server snapshot with the same ID at click", () => {
    const { onChange } = show()
    state = { ...state, records: [{ ...server, performanceSeconds: 1100, savedAt: "2026-10-02T01:00:00.000Z" }] }
    fireEvent.click(screen.getByRole("button"))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("status").textContent).toContain("최신 기록")
  })
  it("reacts to server deletion and confirmation events without changing parent record props", () => {
    show()
    act(() => { state = { ...state, status: "DELETED", confirmed: false }; window.dispatchEvent(new Event(ACCOUNT_ATHLETE_RECORD_EVENT)) })
    expect(screen.queryByRole("button")).toBeNull()
    act(() => { state = { ...state, status: "READY", confirmed: true }; window.dispatchEvent(new Event(ACCOUNT_ATHLETE_RECORD_EVENT)) })
    expect(screen.getByRole("button")).toBeDefined()
  })
  it("hides the old account offer after a scope switch and removes subscriptions on unmount", () => {
    const { onChange, unmount } = show()
    const remove = vi.spyOn(window, "removeEventListener")
    act(() => { setActiveLocalAccount(B) })
    expect(screen.queryByRole("button")).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith(ACCOUNT_ATHLETE_RECORD_EVENT, expect.any(Function))
  })
  it("requires an explicit choice for goal-only confirmed data and does not substitute local extras", () => {
    state.records = [record("goal", { purpose: "RACE_GOAL", achievedOn: null })]
    const { onChange } = show()
    expect(screen.getByRole("button", { name: "이 기록으로 목표 페이스 보기" })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    expect(prepareInitialRecordPaces).toHaveBeenLastCalledWith(generated, state.records, expect.any(String), undefined)
  })
})

describe("reactive consumer source and action guards", () => {
  const inputs = (): WorkoutCalculationInputs => ({ eventDistanceM: 5000, experience: "EXPERIENCED",
    availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [],
    paceReferences: [createSegmentRecordReference("part-0", server, "2026-10-02", "FIVE_K_THRESHOLD_V1")] })
  it("hydrates mounted consumers without calling their guest loader while signed in", () => {
    state = { ...state, status: "LOADING", confirmed: false }
    const guestLoader = vi.fn((): readonly AthleteRecord[] => [device])
    const { result } = renderHook(() => useEligibleAccountPaceRecords(guestLoader))
    expect(result.current.records).toEqual([])
    act(() => { state = { ...state, status: "READY", confirmed: true }; window.dispatchEvent(new Event(ACCOUNT_ATHLETE_RECORD_EVENT)) })
    expect(result.current.records).toEqual([server])
    expect(guestLoader).not.toHaveBeenCalled()
  })
  it("action reads observe deletion even before a subscription event", () => {
    const { result } = renderHook(() => useEligibleAccountPaceRecords())
    expect(result.current.records).toEqual([server])
    state = { ...state, status: "DELETED", confirmed: false }
    expect(result.current.readRecords()).toEqual([])
    expect(isEligiblePaceRecordCurrent(server)).toBe(false)
    expect(areCatalogPaceSourcesCurrent(inputs())).toBe(false)
  })
  it("preserves readonly guest injection and refreshes after focus", () => {
    setActiveLocalAccount(null)
    let guest: readonly AthleteRecord[] = Object.freeze([device])
    const loader = () => guest
    const { result } = renderHook(() => useEligibleAccountPaceRecords(loader))
    expect(result.current.records).toEqual([device])
    expect(isEligiblePaceRecordCurrent(device, result.current.readRecords())).toBe(true)
    act(() => { guest = Object.freeze([server]); window.dispatchEvent(new Event("focus")) })
    expect(result.current.records).toEqual([server])
    expect(isEligiblePaceRecordCurrent(device, result.current.readRecords())).toBe(false)
  })
  it("updates account scopes and unsubscribes all refresh events", () => {
    const { result, unmount } = renderHook(() => useEligibleAccountPaceRecords())
    act(() => { setActiveLocalAccount(B) })
    expect(result.current.records).toEqual([])
    act(() => { state = { ...state, ownerId: B, records: [device] }; window.dispatchEvent(new Event(ACCOUNT_ATHLETE_RECORD_EVENT)) })
    expect(result.current.records).toEqual([device])
    const remove = vi.spyOn(window, "removeEventListener")
    unmount()
    for (const event of [ACCOUNT_ATHLETE_RECORD_EVENT, "storage", "focus"]) {
      expect(remove).toHaveBeenCalledWith(event, expect.any(Function))
    }
  })
  it.each([
    { performanceSeconds: 1100 }, { savedAt: "2026-10-02T01:00:00.000Z" },
    { achievedOn: "2026-09-30" }, { eventDistanceM: 10000 }, { verificationState: "UNVERIFIED" as const },
  ])("rejects changed snapshots at action time: %j", change => {
    expect(isEligiblePaceRecordCurrent(server)).toBe(true)
    expect(areCatalogPaceSourcesCurrent(inputs())).toBe(true)
    state.records = [record("server", change)]
    expect(isEligiblePaceRecordCurrent(server)).toBe(false)
    expect(areCatalogPaceSourcesCurrent(inputs())).toBe(false)
  })
  it("does not block record-free operations while the account source is pending", () => {
    state = { ...state, status: "PENDING", confirmed: false }
    expect(areCatalogPaceSourcesCurrent({ ...inputs(), paceReferences: [] })).toBe(true)
  })
  it("rechecks legacy fiveK against the confirmed source rather than a device extra", () => {
    const legacy: WorkoutCalculationInputs = { ...inputs(), paceReferences: [], fiveK: {
      recordId: server.id, seconds: server.performanceSeconds, achievedAt: server.achievedOn!, evaluatedAt: "2026-10-02",
    } }
    expect(areCatalogPaceSourcesCurrent(legacy)).toBe(true)
    state.records = []
    expect(areCatalogPaceSourcesCurrent(legacy)).toBe(false)
  })
})
