import { act, cleanup, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountAthleteRecordsState } from "../domain/account/account-athlete-record-service"
import type { AthleteRecord } from "../domain/athlete-records"

const mocks = vi.hoisted(() => ({ state: {} as AccountAthleteRecordsState, enabled: true, load: vi.fn() }))
vi.mock("../domain/account/account-athlete-record-service", () => ({
  ACCOUNT_ATHLETE_RECORD_EVENT: "trainoracle:account-athlete-records-changed",
  accountAthleteRecordsEnabled: () => mocks.enabled,
  readAccountAthleteRecordsState: () => mocks.state,
  loadAccountAthleteRecords: mocks.load,
}))
vi.mock("../components/OracleReturnPanel", () => ({ OracleReturnPanel: ({ currentFingerprints }: { currentFingerprints: unknown }) => <output data-testid="fingerprints">{JSON.stringify(currentFingerprints)}</output> }))
vi.mock("../hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ history: undefined, journalReadComplete: true }) }))

import { useAthleteRecordsSnapshot } from "./useAthleteRecordsSnapshot"
import { useAccountAthleteRecordsRuntime } from "../domain/account/useAccountAthleteRecordsRuntime"
import { ATHLETE_RECORDS_STORAGE_KEY, loadAthleteRecords, saveAthleteRecord } from "../domain/athlete-records"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { accountScopedStorageKeyFor } from "../domain/account/local-account-scope"
import { createOracleReturnStore } from "../domain/oracle-return-state"
import { Home } from "../screens/Home"
import { OracleResume } from "../components/OracleResume"

const record: AthleteRecord = { schemaVersion: 1, id: "synthetic-record", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
  performanceSeconds: 1000, achievedOn: "2024-03-10", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:synthetic-record", savedAt: "2026-07-27T03:00:00.000Z" }
function publish(status: AccountAthleteRecordsState["status"], ownerId = "a", records: AthleteRecord[] = [record]) {
  act(() => {
    mocks.state = { status, ownerId, records, confirmed: status === "READY", documentId: "synthetic", serverRevision: 1 }
    window.dispatchEvent(new Event("trainoracle:account-athlete-records-changed"))
  })
}
beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(null); mocks.enabled = true
  mocks.state = { status: "IDLE", ownerId: null, records: [], confirmed: false, documentId: null, serverRevision: null }
  mocks.load.mockResolvedValue(mocks.state)
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); localStorage.clear() })

it("isolates account snapshots and never falls back to guest or stale account cache during loading, failure, or deletion", () => {
  localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([record]))
  localStorage.setItem(accountScopedStorageKeyFor(ATHLETE_RECORDS_STORAGE_KEY, "a"), JSON.stringify([record]))
  setActiveLocalAccount("a")
  const { result } = renderHook(useAthleteRecordsSnapshot)
  expect(result.current).toMatchObject({ status: "LOADING", records: [] })
  publish("READY")
  expect(result.current.records).toEqual([record])
  act(() => setActiveLocalAccount("b"))
  expect(result.current.records).toEqual([])
  publish("READY", "a")
  expect(result.current.records).toEqual([])
  publish("FAILED", "b")
  expect(result.current.status).toBe("UNAVAILABLE")
  publish("DELETED", "b")
  expect(result.current).toMatchObject({ status: "READY", records: [] })
  act(() => setActiveLocalAccount(null))
  expect(result.current.records).toEqual([record])
})

it("keeps local guest saves visible on rerender and storage/focus events", () => {
  const { result, rerender } = renderHook(useAthleteRecordsSnapshot)
  expect(result.current.records).toEqual([])
  expect(saveAthleteRecord(record).ok).toBe(true)
  rerender()
  expect(result.current.records).toEqual([record])
  localStorage.removeItem(ATHLETE_RECORDS_STORAGE_KEY)
  act(() => window.dispatchEvent(new Event("storage")))
  expect(result.current.records).toEqual([])
  localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([record]))
  act(() => window.dispatchEvent(new Event("focus")))
  expect(result.current.records).toEqual([record])
})

it("refreshes the real Home after a late online response without an unrelated render", () => {
  setActiveLocalAccount("a")
  function RuntimeHome() {
    useAccountAthleteRecordsRuntime()
    return <Home onOpenOracle={vi.fn()} />
  }
  render(<RuntimeHome />)
  expect(screen.getByText("계정의 경기 기록을 불러오고 있어요.")).toBeVisible()
  expect(loadAthleteRecords()).toEqual([])
  publish("READY")
  expect(screen.queryByText("계정의 경기 기록을 불러오고 있어요.")).toBeNull()
  expect(loadAthleteRecords()).toEqual([record])
})

it("refreshes OracleResume fingerprints for late records and withholds them while unresolved", () => {
  setActiveLocalAccount("a")
  const store = createOracleReturnStore()
  store.enableOptIn()
  store.saveInterest("level")
  render(<OracleResume onOpenTopic={vi.fn()} />)
  expect(screen.getByTestId("fingerprints")).toHaveTextContent('"level":null')
  publish("READY")
  const first = screen.getByTestId("fingerprints").textContent
  expect(first).not.toContain('"level":null')
  publish("READY", "a", [{ ...record, id: "second", performanceSeconds: 1100 }])
  expect(screen.getByTestId("fingerprints").textContent).not.toBe(first)
  publish("FAILED")
  expect(screen.getByTestId("fingerprints")).toHaveTextContent('"level":null')
})
