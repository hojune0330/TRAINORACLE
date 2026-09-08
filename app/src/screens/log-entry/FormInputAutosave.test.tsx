import React from "react"
import { webcrypto } from "node:crypto"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AccountJournalDraftBuffer, AccountJournalDraftView } from "../../domain/account/account-journal-draft-buffer"

const mocks = vi.hoisted(() => ({ buffer: vi.fn(), request: vi.fn(), persist: vi.fn() }))
vi.mock("./form-finalization-reader", () => ({ readFormFinalization: async () => null }))
vi.mock("./form-input-recovery", () => ({
  createFormRecoveryCoordinator: () => ({ list: async () => [], logout: () => {}, close: () => {} }),
}))
vi.mock("./form-input-draft", async original => ({
  ...await original<typeof import("./form-input-draft")>(), createFormDraftBuffer: () => mocks.buffer(),
}))
vi.mock("../../domain/account/account-journal-api", async original => ({
  ...await original<typeof import("../../domain/account/account-journal-api")>(),
  requestAccountJournal: (...args: unknown[]) => mocks.request(...args),
}))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => true, persistAccountJournalRecord: (...args: unknown[]) => mocks.persist(...args),
}))
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { decodeFormDraft, formDraftEnvelopeSchema } from "./form-input-draft"
import { EveningCheckin } from "./EveningCheckin"
import { RaceForm } from "./RaceForm"
import { PostSessionForm } from "./PostSessionForm"
import { QuickSessionForm } from "./QuickSessionForm"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const records = new Map<string, AccountJournalDraftView>()
let holdWrite: Promise<void> | null = null
let failWrite = false
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// Stateful transport/storage double tests form orchestration only. Actual encrypted
// IndexedDB durability is exercised separately in the browser harness.
function bufferDouble(): AccountJournalDraftBuffer {
  let disposed = false
  const key = (owner: string, doc: string) => {
    if (disposed) throw new Error("Disposed fixture")
    return `${owner}:${doc}`
  }
  return {
    async saveDraft(owner, doc, draft, expected) {
      if (holdWrite) await holdWrite
      if (failWrite) throw new Error("Synthetic quota failure")
      formDraftEnvelopeSchema.parse(draft)
      const k = key(owner, doc), old = records.get(k)
      if (expected !== (old?.localSequence ?? 0)) throw new Error("Synthetic CAS mismatch")
      records.set(k, { ownerId: owner, documentId: doc, serverRevision: old?.serverRevision ?? 0,
        localSequence: (old?.localSequence ?? 0) + 1, acknowledgedSequence: old?.acknowledgedSequence ?? 0,
        state: old?.blocked ? "CONFLICT" : "LOCAL_CHANGES", draft: copy(draft), pending: old?.pending ?? null,
        blocked: old?.blocked ?? null, remoteDraft: null })
    },
    async read(owner, doc) { const view = records.get(key(owner, doc)); return view ? copy(view) : null },
    async list(owner) { return [...records.values()].filter(view => view.ownerId === owner).map(copy) },
    async queue(owner, doc, operationId) {
      const v = records.get(key(owner, doc))!
      v.pending = { operationId, expectedRevision: v.serverRevision, sequence: v.localSequence, draft: copy(v.draft) }
      v.state = "PENDING"
    },
    async ack(owner, doc, id, revision) {
      const v = records.get(key(owner, doc))!
      if (!v.pending || v.pending.operationId !== id || revision !== v.pending.expectedRevision + 1) return false
      v.acknowledgedSequence = v.pending.sequence; v.serverRevision = revision; v.pending = null
      v.state = v.acknowledgedSequence === v.localSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES"
      return true
    },
    async conflict(owner, doc, id, revision) {
      const v = records.get(key(owner, doc))!
      v.blocked = { kind: "RECEIPT", operationId: id, currentRevision: revision }; v.state = "CONFLICT"
      return true
    },
    async importRemote(owner, doc, draft, revision) {
      formDraftEnvelopeSchema.parse(draft)
      records.set(key(owner, doc), { ownerId: owner, documentId: doc, serverRevision: revision,
        localSequence: 1, acknowledgedSequence: 1, state: "DRAFT_ACKNOWLEDGED", draft: copy(draft),
        pending: null, blocked: null, remoteDraft: null })
      return "IMPORTED"
    },
    clear: vi.fn(),
    logout() { disposed = true }, close() { disposed = true },
  } as AccountJournalDraftBuffer
}
const savedInput = () => decodeFormDraft([...records.values()].find(v => v.ownerId === A)!.draft).input
const settle = async () => { await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }) }
const idle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 850)) }) }
const components = { evening: EveningCheckin, race: RaceForm, "post-session": PostSessionForm }

beforeEach(() => {
  records.clear(); holdWrite = null; failWrite = false
  vi.stubGlobal("crypto", webcrypto)
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  setActiveLocalAccount(A)
  mocks.buffer.mockImplementation(bufferDouble)
  mocks.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
  mocks.request.mockImplementation(async (_owner, request) => request.action === "read"
    ? { ok: false, code: "NOT_FOUND" }
    : { ok: true, data: { kind: "saved", documentId: request.documentId,
      operationId: request.operationId, revision: request.expectedRevision + 1 } })
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("existing form input autosave", () => {
  it.each([
    ["evening", "체중 (kg)", "62."], ["race", "목표 페이스 분", "03"],
    ["post-session", "세션 제목", " synthetic partial "],
  ] as const)("restores %s partial fields without finalization", async (kind, label, value) => {
    const Component = components[kind]
    render(<Component targetDate="2026-09-08" />)
    // Race inputs use their field labels from RacePreChecks.
    const field = kind === "race" ? await screen.findByLabelText(/목표.*분|페이스.*분/) : await screen.findByRole("textbox", { name: label })
    fireEvent.change(field, { target: { value } })
    await waitFor(() => expect(records.size).toBe(1))
    const before = savedInput()
    cleanup()
    render(<Component targetDate="2026-09-08" />)
    const restored = kind === "race" ? await screen.findByLabelText(/목표.*분|페이스.*분/) : await screen.findByRole("textbox", { name: label })
    expect(restored).toHaveValue(kind === "race" ? Number(value) : value)
    if (kind === "race") expect(before).toMatchObject({ paceMinutes: "03", paceSeconds: "" })
    expect(savedInput()).toEqual(before)
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("restores quick RPE skipped versus missing and never recovers the saved screen", async () => {
    render(<QuickSessionForm targetDate="2026-09-08" />)
    fireEvent.click(await screen.findByRole("button", { name: "운동을 마쳤어요" }))
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    fireEvent.click(screen.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요" }))
    await waitFor(() => expect(savedInput()).toMatchObject({ rpe: 0, effortAnswered: true, step: "effort", painStatus: "UNANSWERED" }))
    cleanup(); render(<QuickSessionForm targetDate="2026-09-08" />)
    expect(await screen.findByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "완료" })).toBeNull()
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("preserves memo with no selected purpose without invoking the finalize validator", async () => {
    render(<EveningCheckin targetDate="2026-09-08" />)
    fireEvent.change(await screen.findByRole("textbox", { name: "오늘의 메모" }), { target: { value: "synthetic unselected memo" } })
    await waitFor(() => expect(savedInput()).toMatchObject({ memo: "synthetic unselected memo", purpose: null }))
    cleanup(); render(<EveningCheckin targetDate="2026-09-08" />)
    expect(await screen.findByRole("textbox", { name: "오늘의 메모" })).toHaveValue("synthetic unselected memo")
    expect(screen.getByRole("radio", { name: "나만의 메모" })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: "훈련 메모" })).not.toBeChecked()
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("restores unadded objective component fields and planned RPE", async () => {
    render(<PostSessionForm targetDate="2026-09-08" />)
    await screen.findByRole("textbox", { name: "세션 제목" })
    fireEvent.click(screen.getByRole("button", { name: "예상 강도 7" }))
    fireEvent.change(screen.getByLabelText("운동 시간 (초)"), { target: { value: "42" } })
    await waitFor(() => expect(savedInput()).toMatchObject({ plannedRpe: 7, objectiveComponents: [],
      objectiveEditor: { kind: "INTERVALS", fields: { workSeconds: "42" } } }))
    cleanup(); render(<PostSessionForm targetDate="2026-09-08" />)
    await screen.findByRole("textbox", { name: "세션 제목" })
    expect(screen.getByRole("button", { name: "예상 강도 7" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("운동 시간 (초)")).toHaveValue(42)
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("isolates accounts in mounted forms and restores only the original owner", async () => {
    render(<EveningCheckin targetDate="2026-09-08" />)
    fireEvent.change(await screen.findByRole("textbox", { name: "체중 (kg)" }), { target: { value: "62." } })
    await waitFor(() => expect(records.size).toBe(1))
    act(() => setActiveLocalAccount(B))
    expect(await screen.findByRole("textbox", { name: "체중 (kg)" })).toHaveValue("")
    expect([...records.values()].every(v => v.ownerId === A)).toBe(true)
    act(() => setActiveLocalAccount(A))
    expect(await screen.findByRole("textbox", { name: "체중 (kg)" })).toHaveValue("62.")
  })

  it("never reuses inherited entry props from account A after switching to account B", async () => {
    render(<EveningCheckin initialEntry={{ id: "synthetic-existing", kind: "evening", date: "2026-09-08",
      savedAt: "2026-09-08T00:00:00.000Z", syncState: "local", sleepH: 0, sleepQuality: 0,
      weightKg: "", restingHr: "", mood: 0, painParts: {}, note: "synthetic inherited memo" }} />)
    expect(await screen.findByRole("textbox", { name: "오늘의 메모" })).toHaveValue("synthetic inherited memo")
    act(() => setActiveLocalAccount(B))
    expect(screen.getByText("계정이 변경됐어요. 기록 목록에서 다시 열어 주세요.")).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
    expect(records.size).toBe(0)
  })

  it("blocks navigation and unload until encrypted local write completion; quota failure stays blocked", async () => {
    render(<EveningCheckin targetDate="2026-09-08" />)
    const field = await screen.findByRole("textbox", { name: "체중 (kg)" })
    let release!: () => void
    holdWrite = new Promise(resolve => { release = resolve })
    fireEvent.change(field, { target: { value: "62." } })
    const navigate = vi.fn()
    act(() => { expect(runDraftSafeNavigation(navigate)).toBe(false) })
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true)
    release(); await settle()
    act(() => { expect(runDraftSafeNavigation(navigate)).toBe(true) })
    failWrite = true
    fireEvent.change(field, { target: { value: "63." } }); await settle()
    act(() => { expect(runDraftSafeNavigation(navigate)).toBe(false) })
    expect(savedInput()).toMatchObject({ weight: "62." })
  })

  it("writes locally immediately, sends only after 800ms, and ignores a late ACK for newer input", async () => {
    render(<EveningCheckin targetDate="2026-09-08" />)
    const field = await screen.findByRole("textbox", { name: "체중 (kg)" })
    let acknowledge!: () => void
    mocks.request.mockImplementation((_owner, request) => new Promise(resolve => {
      acknowledge = () => resolve({ ok: true, data: { kind: "saved", documentId: request.documentId,
        operationId: request.operationId, revision: request.expectedRevision + 1 } })
    }))
    fireEvent.change(field, { target: { value: "62." } }); await settle()
    expect(records.size).toBe(1)
    expect(mocks.request.mock.calls.filter(c => c[1].action === "save")).toHaveLength(0)
    await idle()
    expect(mocks.request.mock.calls.filter(c => c[1].action === "save")).toHaveLength(1)
    fireEvent.change(field, { target: { value: "63." } }); await settle()
    acknowledge(); await settle()
    expect(savedInput()).toMatchObject({ weight: "63." })
    expect(screen.queryByText("초안이 계정에 저장됨 · 기록 미완료")).toBeNull()
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("retains input after finalized PENDING, and retires only after finalized ACCOUNT acknowledgement", async () => {
    mocks.persist.mockResolvedValueOnce({ ok: true, storage: "PENDING" })
    const done = vi.fn()
    render(<EveningCheckin targetDate="2026-09-08" onDone={done} />)
    fireEvent.change(await screen.findByRole("textbox", { name: "체중 (kg)" }), { target: { value: "62." } }); await settle()
    fireEvent.click(screen.getByRole("button", { name: /^저장/ })); await settle()
    expect(done).not.toHaveBeenCalled()
    expect(decodeFormDraft([...records.values()][0]!.draft).completed).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: /^저장/ })); await settle()
    expect(done).toHaveBeenCalledOnce()
    expect(decodeFormDraft([...records.values()][0]!.draft).completed).toBe(true)
  })

  it("recovers from a server DRAFT on a device with no local cache", async () => {
    render(<RaceForm targetDate="2026-09-08" />)
    fireEvent.click(await screen.findByRole("button", { name: "긴장도 10" }))
    await waitFor(() => expect(savedInput()).toMatchObject({ tension: 10 }))
    const remote = copy([...records.values()][0]!)
    cleanup(); records.clear()
    mocks.request.mockResolvedValueOnce({ ok: true, data: { kind: "document", documentId: remote.documentId,
      revision: 4, document: remote.draft } })
    render(<RaceForm targetDate="2026-09-08" />)
    expect(await screen.findByRole("button", { name: "긴장도 10" })).toHaveAttribute("aria-pressed", "true")
    expect([...records.values()][0]!.serverRevision).toBe(4)
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("ignores delayed account A reads after switching to B", async () => {
    let release!: (value: unknown) => void
    mocks.request.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    render(<EveningCheckin targetDate="2026-09-08" />)
    await waitFor(() => expect(mocks.request).toHaveBeenCalled())
    act(() => setActiveLocalAccount(B))
    expect(await screen.findByRole("textbox", { name: "체중 (kg)" })).toHaveValue("")
    release({ ok: false, code: "INVALID_RESPONSE" }); await settle()
    expect(screen.queryByText("초안 조회 실패 또는 형식 확인 필요 · 기존 초안은 유지됨")).toBeNull()
    expect(records.size).toBe(0)
  })

  it("keeps malformed remote content out of the form without overwriting it", async () => {
    mocks.request.mockImplementationOnce(async (_owner, request) => ({ ok: true, data: { kind: "document",
      documentId: request.documentId, revision: 1, document: { version: 1, state: "DRAFT", visibility: "PRIVATE",
        date: "2026-09-08", title: "TRAINORACLE_FORM_INPUT_V1", body: "not a validated form snapshot" } } }))
    render(<EveningCheckin targetDate="2026-09-08" />)
    expect(await screen.findByText("초안 조회 실패 또는 형식 확인 필요 · 기존 초안은 유지됨")).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
    expect(records.size).toBe(0)
    expect(mocks.persist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "초안 조회 재시도" }))
    expect(await screen.findByRole("textbox", { name: "체중 (kg)" })).toHaveValue("")
    expect(records.size).toBe(0)
  })

  it("labels offline drafts locally and resumes transport on online without finalization", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(<EveningCheckin targetDate="2026-09-08" />)
    fireEvent.change(await screen.findByRole("textbox", { name: "체중 (kg)" }), { target: { value: "62." } })
    await idle()
    expect(screen.getByText("연결 대기 · 초안은 이 기기에 보관됨")).toBeVisible()
    expect(mocks.request).not.toHaveBeenCalled()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    act(() => window.dispatchEvent(new Event("online")))
    await waitFor(() => expect(screen.getByText("초안이 계정에 저장됨 · 기록 미완료")).toBeVisible())
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("recovers the accepted edit baseline and stable entry ID after a post-ACK correction", async () => {
    render(<EveningCheckin targetDate="2026-09-08" />)
    fireEvent.change(await screen.findByRole("textbox", { name: "체중 (kg)" }), { target: { value: "62." } }); await settle()
    fireEvent.click(screen.getByRole("button", { name: /^저장/ })); await settle()
    const accepted = mocks.persist.mock.calls[0]![0]
    fireEvent.change(screen.getByRole("textbox", { name: "체중 (kg)" }), { target: { value: "63." } }); await settle()
    expect(decodeFormDraft([...records.values()][0]!.draft)).toMatchObject({ completed: false,
      entryId: accepted.id, baseSavedAt: accepted.savedAt })
    cleanup(); render(<EveningCheckin targetDate="2026-09-08" />)
    expect(await screen.findByRole("textbox", { name: "체중 (kg)" })).toHaveValue("63.")
    fireEvent.click(screen.getByRole("button", { name: /^저장/ })); await settle()
    expect(mocks.persist.mock.calls[1]![0].id).toBe(accepted.id)
    expect(mocks.persist.mock.calls[1]![1]).toBe(accepted.savedAt)
  })
})
