import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("./account-journal-api", () => ({ accountJournalPreviewEnabled: () => true, requestAccountDocument: mocks.request }))
vi.mock("./account-journal-draft-buffer", () => ({ createAccountDocumentBuffer: () => ({ close: vi.fn(), read: async () => null }) }))

import { useAccountAthleteRecordsRuntime } from "./useAccountAthleteRecordsRuntime"
import { disposeAccountAthleteRecords, readAccountAthleteRecordsState } from "./account-athlete-record-service"
import { assignJournalsToAccount, setActiveLocalAccount } from "./local-journal-ownership"

beforeEach(() => {
  localStorage.clear()
  disposeAccountAthleteRecords()
  setActiveLocalAccount("account-a")
  mocks.request.mockReset().mockImplementation(async (_owner: string, request: { action: string }) => request.action === "athleteRecordSupport"
    ? { ok: true, data: { kind: "athlete-record-support", version: 1 } }
    : { ok: false, code: "NOT_FOUND" })
})
afterEach(() => { cleanup(); disposeAccountAthleteRecords(); setActiveLocalAccount(null); localStorage.clear() })

it("reloads after same-account journal ownership changes even when runtime subscribes before service disposal", async () => {
  renderHook(useAccountAthleteRecordsRuntime)
  await waitFor(() => expect(readAccountAthleteRecordsState().status).toBe("EMPTY"))
  mocks.request.mockClear()
  act(() => { expect(assignJournalsToAccount(["device-journal"], "account-a")).toBe(true) })
  await waitFor(() => expect(readAccountAthleteRecordsState()).toMatchObject({ status: "EMPTY", ownerId: "account-a" }))
  expect(mocks.request.mock.calls.some(([owner, request]) => owner === "account-a" && request.action === "read")).toBe(true)
})

it("uses the final account after rapid scope changes and never reloads the prior owner", async () => {
  renderHook(useAccountAthleteRecordsRuntime)
  await waitFor(() => expect(readAccountAthleteRecordsState().status).toBe("EMPTY"))
  mocks.request.mockClear()
  act(() => { setActiveLocalAccount("account-b"); setActiveLocalAccount("account-c") })
  await waitFor(() => expect(readAccountAthleteRecordsState()).toMatchObject({ status: "EMPTY", ownerId: "account-c" }))
  expect(mocks.request.mock.calls.every(([owner]) => owner === "account-c")).toBe(true)
})

it("does not start a queued reload after unmount", async () => {
  const view = renderHook(useAccountAthleteRecordsRuntime)
  await waitFor(() => expect(readAccountAthleteRecordsState().status).toBe("EMPTY"))
  mocks.request.mockClear()
  await act(async () => { assignJournalsToAccount(["device-journal"], "account-a"); view.unmount() })
  expect(mocks.request).not.toHaveBeenCalled()
})
