import React from "react"
import { webcrypto } from "node:crypto"
import { beforeEach, afterEach, it, expect, vi } from "vitest"
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { ACCOUNT_PLAN_EVENT, type AccountPlanTrust } from "../../domain/account/account-plan-service"
import { createAccountPlanCollectionService } from "../../domain/account/account-plan-collection-service"
import { collectionServer, collectionMemoryBuffers, COLLECTION_OWNER } from "../../domain/account/account-plan-collection.test-support"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"
import { adjustedPlanSelectionFixture } from "../../domain/adjusted-plan-selection.test-fixtures"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { multiAdjustedPlanReviewScopeV3 } from "../../domain/adjusted-plan-multi-review-v3"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { AdjustedPlanApplyReview } from "./AdjustedPlanApplyReview"
import { AdjustedPlanApplyReviewV3 } from "./AdjustedPlanApplyReviewV3"
import { MultiAdjustedPlanApplyReviewV3 } from "./MultiAdjustedPlanApplyReviewV3"
import { PlanBeta } from "../PlanBeta"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage } from "../../domain/plan-beta-store"
import { loadAthleteRecords } from "../../domain/athlete-records"
import * as athleteRecordsService from "../../domain/account/account-athlete-record-service"

const runtime = vi.hoisted(() => ({ service: null as ReturnType<typeof createAccountPlanCollectionService> | null, enabled: false }))
vi.mock("../../domain/account/account-plan-service", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/account-plan-service")>(),
  accountPlanService: () => runtime.service, accountPlansEnabled: () => runtime.enabled,
}))
const locks = { request: async <T,>(_n: string, _o: unknown, callback: (lock: object) => Promise<T>): Promise<T> => callback({}) }
const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks")
let trusted: ReturnType<AccountPlanTrust> = [], remote: ReturnType<typeof collectionServer>
let recordsConfirmed = false
const RECORD_DOCUMENT_ID = "44444444-4444-4444-8444-444444444444"
function createService() {
  const stores = collectionMemoryBuffers()
  return createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => runtime.enabled,
    client: remote.client, buffers: stores.dependencies, legacyBuffer: stores.legacy.buffer,
    runExclusive: async run => run(), yieldTask: async () => {}, online: () => true,
    readTrusted: () => trusted, changed: () => window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)) })
}
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(TODAY); vi.stubGlobal("crypto", webcrypto)
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(COLLECTION_OWNER)
  resetAccountJournalProjection(COLLECTION_OWNER)
  setAccountJournalProjectionStatus(COLLECTION_OWNER, "READY")
  trusted = []; remote = collectionServer(); runtime.enabled = true
  recordsConfirmed = false
  // Synthetic server-confirmed source uses the exact records created by the existing fixture.
  vi.spyOn(athleteRecordsService, "readAccountAthleteRecordsState").mockImplementation(() => ({
    ownerId: COLLECTION_OWNER, status: recordsConfirmed ? "READY" : "PENDING", confirmed: recordsConfirmed,
    documentId: RECORD_DOCUMENT_ID, serverRevision: 1, records: loadAthleteRecords(TODAY),
  }))
  runtime.service = createService()
  await runtime.service.hydrate()
  Object.defineProperty(navigator, "locks", { configurable: true, value: locks })
}, 30_000)
afterEach(() => { cleanup(); runtime.service?.close(); runtime.service = null; runtime.enabled = false
  if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks)
  else Reflect.deleteProperty(navigator, "locks")
  resetAccountJournalProjection(null); setActiveLocalAccount(null); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it.each([4, 5, 6] as const)("V%s actual apply, schedule progress, account archive and unverified new-device original display", async version => {
  const onSaved = vi.fn(), key = activePlanBetaStorageKey()
  localStorage.setItem(key, "DEVICE_ORIGINAL")
  const f4 = version === 4 ? adjustedPlanSelectionFixture() : null
  const f5 = version !== 4 ? adjustedPlanSelectionV3Fixture() : null
  const retained4 = f4?.retained ?? [], retained5 = f5 ? [f5.retained] : []
  const scope = f5 ? multiAdjustedPlanReviewScopeV3([f5.request.preparation], f5.request.intake.experienceBand) : null
  if (version === 6 && scope?.kind !== "scope") throw Error("scope")
  const policy6 = f5 && scope?.kind === "scope" ? { ...f5.policy, scopeVersion: "MULTI_STRUCTURAL_V3" as const, scopeFingerprint: scope.scopeFingerprint } : null
  const retained6 = f5 && policy6 ? [{ slots: [{ address: f5.request.preparation.address, authority: f5.retained.authority,
    explanation: f5.retained.explanation }], rpeBindings: [], policies: [policy6] }] : []
  trusted = version === 4 ? retained4 : version === 5 ? retained5 : retained6
  const common = { onSaved, onCancel: () => {}, isCurrentDraft: () => true, locks }
  const ui = render(version === 4 && f4 ? <AdjustedPlanApplyReview {...common} request={f4.request} readReview={() => f4.review} />
    : version === 5 && f5 ? <AdjustedPlanApplyReviewV3 {...common} seed={f5.request} readReview={() => ({ source: f5.request.preparation.source,
      explanation: f5.retained.explanation, retained: retained5, policies: [f5.policy] })} />
      : f5 && policy6 && scope?.kind === "scope" ? <MultiAdjustedPlanApplyReviewV3 {...common}
        seed={{ ...f5.request, preparations: [f5.request.preparation], expectedCandidateFingerprint: scope.candidate.contentFingerprint }}
        readReview={() => ({ preparations: [f5.request.preparation], rpeBindings: [], retained: retained6, policies: [policy6] })} /> : <></>)
  fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" }))
  await screen.findByRole("alert")
  expect(onSaved).not.toHaveBeenCalled()
  expect(remote.revision()).toBe(0)
  expect(localStorage.getItem(key)).toBe("DEVICE_ORIGINAL")
  recordsConfirmed = true
  fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1), { timeout: 10_000 })
  expect(remote.revision()).toBe(1)
  expect(remote.commits[0]?.journalGuard).toEqual([])
  // V4-V6 adjusted prescriptions use their retained review contract, not a new PACE_TARGET receipt.
  expect(remote.commits[0]?.paceRecordGuard).toBeUndefined()
  expect(localStorage.getItem(key)).toBe("DEVICE_ORIGINAL")
  ui.unmount()
  const plan = render(<PlanBeta readAdjustedEvidence={() => retained4} readAdjustedEvidenceV3={() => retained5} readMultiAdjustedEvidenceV3={() => retained6} />)
  // Mount starts a fresh server read; the previous save receipt alone is not readiness.
  await waitFor(() => expect(runtime.service!.snapshot().status).toBe("READY"), { timeout: 10_000 })
  await waitFor(() => expect(screen.getByText("계정에 저장됨", { exact: true })).toBeVisible())
  fireEvent.click(screen.getByRole("button", { name: /크게 보기/u }))
  const mutate = vi.spyOn(runtime.service!, "mutate")
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "완료" })[0]!)
    expect(mutate).toHaveBeenCalledOnce()
    expect(await mutate.mock.results[0]!.value).toBe("ACCOUNT")
  })
  expect(remote.revision()).toBe(2)
  expect(runtime.service!.snapshot().currentPlan).toMatchObject({ packet: { state: { version, progress: [{ state: "COMPLETED" }] } } })
  // The new device has the same authenticated body but no independently retained source packet.
  plan.unmount(); runtime.service!.close(); trusted = []
  runtime.service = createService()
  await act(() => runtime.service!.hydrate())
  const fresh = render(<PlanBeta />)
  await act(() => runtime.service!.hydrate())
  expect(screen.getByRole("heading", { name: "보관한 훈련 일정" })).toBeVisible()
  expect(screen.getByText("완료", { exact: true })).toBeVisible()
  expect(screen.getByText(/현재 훈련을 시작하는 데 필요한 조건과 근거/u)).toBeVisible()
  expect(screen.queryByRole("button", { name: "완료" })).toBeNull()
  expect(readPlanBetaStateFromStorage().kind).toBe("invalid")
  fireEvent.click(screen.getByRole("button", { name: "현재 계획 보관" }))
  fireEvent.click(screen.getByRole("button", { name: "보관하고 현재 계획 끝내기" }))
  await waitFor(() => expect(remote.revision()).toBe(3), { timeout: 10_000 })
  await act(async () => { expect(await runtime.service!.loadHistory()).toBe(true) })
  const document = runtime.service.snapshot().confirmedDocument
  expect(document?.data.currentPlanId).toBeNull()
  expect(document?.data.plans[0]?.snapshot.state.progress).toEqual([])
  expect(document?.data.plans[0]?.progress).toHaveLength(1)
  expect(localStorage.getItem(key)).toBe("DEVICE_ORIGINAL")
  fresh.unmount()
}, 90_000)
