import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FilePlanComparison } from "./FilePlanComparison"
import { accountPlanPacketFixture } from "../../domain/account/account-plan.test-fixtures"
import { accountPlanEntry } from "../../domain/account/account-plan-document-schema"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { TODAY } from "../../domain/prescription-quality-matrix.test-fixtures"
import { comparisonObservationInterpretationFingerprint, resolveComparisonOriginal } from "../../domain/import/file-plan-comparison"
import { projectFileObservation } from "../../domain/import/file-analysis"
import { markCurrentConfirmedAccountJournalProjection, resetAccountJournalProjection } from "../../domain/account/account-journal-projection"
import { buildFileObservation, toFileObservationSummary } from "../../domain/import/file-observation"
import { toImportedEntry } from "../../domain/import/import-draft"
import type { ComparisonRelationV1 } from "../../domain/import/comparison-relation"

const api = vi.hoisted(() => ({ read: vi.fn(), confirm: vi.fn(), release: vi.fn(), retry: vi.fn(), load: vi.fn(), resolve: vi.fn(),
  hydrate: vi.fn(), owner: null as string | null, scope: null as (() => void) | null, listeners: new Set<() => void>() }))
vi.mock("../../domain/account/account-journal-record-service", () => ({ readAccountJournalWriteBase: api.read,
  confirmAccountJournalComparison: api.confirm, releaseAccountJournalComparison: api.release, retryAccountJournalComparison: api.retry }))
vi.mock("../../domain/account/account-journal-projection", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/account-journal-projection")>(), readAccountJournalProjection: () => [] }))
vi.mock("../../domain/account/local-journal-ownership", () => ({
  activeLocalAccount: () => api.owner,
  onLocalJournalScopeChange: (listener: () => void) => {
    api.listeners.add(listener); api.scope = () => { for (const notify of api.listeners) notify() }
    return () => { api.listeners.delete(listener) }
  } }))
vi.mock("../../domain/account/account-plan-service", () => ({ accountPlansEnabled: () => false, accountPlanService: () => ({ hydrate: api.hydrate }) }))
vi.mock("../../domain/import/comparison-plan-source", () => ({ loadComparisonPlanChoices: api.load, resolveAccountComparisonOriginal: api.resolve }))

function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(TODAY)
  const plan = accountPlanEntry(accountPlanPacketFixture(4), TODAY.toISOString())
  const state = plan.snapshot.state.version === 2 || plan.snapshot.state.version === 3 ? plan.snapshot.state : plan.snapshot.state.selection
  const session = state.activePlan.sessions.find(value => value.prescription.kind === "ADJUSTED_METHOD")!
  const reference = { planFingerprint: plan.planId, session: createPlannedSessionLogDraft(state, session, TODAY.toISOString())!.link }
  const original = resolveComparisonOriginal(plan.snapshot, reference)
  if (original.status !== "ORIGINAL_VERIFIED") throw Error("fixture original invalid")
  const laps = original.segments.map((segment, sourceIndex) => ({ sourceIndex, distanceMeters: segment.distanceMeters ?? 100,
    durationSeconds: (segment.durationSeconds ?? 30) + 2, durationMeaning: "TIMER" as const, kind: "UNKNOWN" as const }))
  const observation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: "synthetic",
    date: reference.session.plannedDate, startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: laps.reduce((sum, lap) => sum + lap.distanceMeters, 0), durationSeconds: laps.reduce((sum, lap) => sum + lap.durationSeconds, 0),
    durationMeaning: "TIMER", laps, confirmation: { durationMeaning: null, sport: null } })
  const entry = toImportedEntry({ date: observation.date, name: "Synthetic", sport: "Running", observation, ...toFileObservationSummary(observation) }, "tcx", { includeFileObservation: true })
  const choice = { choiceId: "choice", reference, planVersion: 4 as const, generatedAt: state.generatedAt, archivedAt: null, isCurrentPlan: true, prescriptionKind: "ADJUSTED_METHOD" }
  vi.useRealTimers()
  return { plan, reference, original, entry, choice }
}
let f: ReturnType<typeof fixture>
beforeEach(() => {
  vi.resetAllMocks(); api.owner = null; resetAccountJournalProjection(null); localStorage.clear(); sessionStorage.clear(); f = fixture()
  vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true"); vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
  api.read.mockResolvedValue({ entry: f.entry, revision: 4, contentFingerprint: "sha256:" + "a".repeat(64) })
  api.load.mockResolvedValue({ status: "AVAILABLE", choices: [f.choice] })
  api.resolve.mockImplementation(async reference => resolveComparisonOriginal(f.plan.snapshot, reference))
  api.hydrate.mockResolvedValue(true)
  api.confirm.mockImplementation(async (_id, relation: ComparisonRelationV1) => {
    api.read.mockResolvedValue({ entry: { ...f.entry, comparisonRelations: [relation] }, revision: 5, contentFingerprint: "sha256:" + "b".repeat(64) })
    return { ok: true, storage: "ACCOUNT" }
  })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.useRealTimers() })
async function open() {
  render(<FilePlanComparison entryId={f.entry.id} />)
  fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
  await waitFor(() => expect(screen.getByRole("option", { name: /주요 훈련/u })).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText("비교할 원래 훈련"), { target: { value: "choice" } })
  await screen.findAllByLabelText("대응하는 실제 구간")
}
describe("FilePlanComparison", () => {
  it("reopens a restored revision-one comparison using its current server confirmation without rewriting historical revision four", async () => {
    const projected = projectFileObservation(f.entry, { sourceContext: "ACCOUNT_CONFIRMED" })
    if (projected.status !== "ACCEPTED") throw Error("fixture observation invalid")
    const segment = f.original.segments[0]!
    const relation: ComparisonRelationV1 = { schemaVersion: 1, relationId: "10000000-0000-4000-8000-000000000001",
      journalId: f.entry.id, journalRevisionAtConfirmation: 4,
      contentRevisionFingerprint: projected.observation.contentRevisionFingerprint,
      observationInterpretationFingerprint: comparisonObservationInterpretationFingerprint(projected.observation),
      original: f.reference, mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED",
      segmentMappings: [{ planSegmentId: segment.id, sourceLapIndex: 0, confirmedKind: segment.kind,
        confirmedTargetUnit: segment.targetUnit, confirmedDurationMeaning: "TIMER", confirmedRecoveryMode: null }],
      createdAt: TODAY.toISOString(), releasedAt: null }
    const entry = { ...f.entry, comparisonRelations: [relation] }
    api.owner = "synthetic-owner"
    resetAccountJournalProjection(api.owner)
    markCurrentConfirmedAccountJournalProjection(api.owner, entry, 1)
    api.read.mockResolvedValue({ entry, revision: 1, contentFingerprint: "sha256:" + "c".repeat(64) })
    render(<FilePlanComparison entryId={f.entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
    await screen.findByRole("option", { name: /주요 훈련/u })
    fireEvent.change(screen.getByLabelText("비교할 원래 훈련"), { target: { value: "choice" } })
    expect(await screen.findByRole("table", { name: "실제 기록 − 계획값" })).toHaveTextContent("+2초")
    expect(relation.journalRevisionAtConfirmation).toBe(4)
    expect(api.confirm).not.toHaveBeenCalled()
  })
  it("does not match numerically similar laps automatically and shows differences only after confirmed storage", async () => {
    await open()
    expect(screen.getByRole("button", { name: "선택한 대응 확인·저장" })).toBeDisabled()
    expect(screen.queryByRole("table", { name: "실제 기록 − 계획값" })).toBeNull()
    fireEvent.change(screen.getAllByLabelText("대응하는 실제 구간")[0]!, { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "선택한 대응 확인·저장" }))
    const table = await screen.findByRole("table", { name: "실제 기록 − 계획값" })
    expect(table).toHaveTextContent("+2초")
    expect(api.confirm).toHaveBeenCalledOnce()
    expect(api.confirm.mock.calls[0]![1]).toMatchObject({ journalId: f.entry.id, journalRevisionAtConfirmation: 4,
      original: f.reference, mappingConfirmation: "USER_CONFIRMED", segmentMappings: [{ sourceLapIndex: 0 }] })
    expect(screen.getByText(/미대응: 계획/u)).toBeVisible()
  })
  it("does not turn a pending confirmation into a saved comparison", async () => {
    api.confirm.mockResolvedValue({ ok: true, storage: "PENDING" })
    await open()
    fireEvent.change(screen.getAllByLabelText("대응하는 실제 구간")[0]!, { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "선택한 대응 확인·저장" }))
    await screen.findByText(/계정 저장은 아직 완료되지/u)
    expect(screen.queryByRole("table", { name: "실제 기록 − 계획값" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "비교 닫기" }))
    fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
    expect(api.read).toHaveBeenCalledOnce()
    expect(screen.getAllByLabelText("대응하는 실제 구간")[0]).toHaveValue("0")
    expect(screen.getByRole("button", { name: "같은 비교 다시 전송" })).toBeEnabled()
  })
  it("clears an old comparison editor if reopening fails to load the original", async () => {
    await open()
    fireEvent.click(screen.getByRole("button", { name: "비교 닫기" }))
    api.read.mockRejectedValueOnce(new Error("synthetic offline"))
    fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
    await screen.findByText(/계획 원본을 불러오지 못했어요/u)
    expect(screen.queryByLabelText("대응하는 실제 구간")).toBeNull()
    expect(screen.queryByRole("button", { name: "선택한 대응 확인·저장" })).toBeNull()
    expect(api.confirm).not.toHaveBeenCalled()
  })
  it("reports unavailable originals without using a current-plan substitute", async () => {
    api.load.mockResolvedValue({ status: "UNAVAILABLE", choices: [] })
    render(<FilePlanComparison entryId={f.entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
    await screen.findByText(/원래 계획을 찾지 못/u)
    expect(api.confirm).not.toHaveBeenCalled(); expect(api.resolve).not.toHaveBeenCalled()
  })
  it("rejects a reversed mapping before sending it", async () => {
    await open()
    const fields = screen.getAllByLabelText("대응하는 실제 구간")
    fireEvent.change(fields[0]!, { target: { value: "1" } })
    fireEvent.change(fields[1]!, { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "선택한 대응 확인·저장" }))
    await screen.findByText(/구간 순서와 운동·회복 종류/u)
    expect(api.confirm).not.toHaveBeenCalled()
  })
  it("clears a late original response on account-scope change", async () => {
    let resolve!: (value: unknown) => void
    api.load.mockImplementation(() => new Promise(done => { resolve = done }))
    render(<FilePlanComparison entryId={f.entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "계획과 비교" }))
    await waitFor(() => expect(api.load).toHaveBeenCalledOnce())
    api.scope?.(); resolve({ status: "AVAILABLE", choices: [f.choice] })
    await waitFor(() => expect(screen.queryByLabelText("비교할 원래 훈련")).toBeNull())
    expect(api.confirm).not.toHaveBeenCalled()
  })
})
