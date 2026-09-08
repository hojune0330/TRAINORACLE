import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry, PostSessionEntry } from "../../domain/journal-store"

const mocks = vi.hoisted(() => ({ enabled: true, persist: vi.fn(),
  save: vi.fn(), update: vi.fn(), privateSave: vi.fn(), privateUpdate: vi.fn() }))
vi.mock("../../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => mocks.enabled,
  persistAccountJournalRecord: (...args: unknown[]) => mocks.persist(...args),
}))
vi.mock("../../domain/journal-store", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/journal-store")>(),
  saveEntry: (...args: unknown[]) => mocks.save(...args),
  updateEntry: (...args: unknown[]) => mocks.update(...args),
  savePrivateEntry: (...args: unknown[]) => mocks.privateSave(...args),
  updatePrivateEntry: (...args: unknown[]) => mocks.privateUpdate(...args),
}))
import { QuickSessionForm } from "./QuickSessionForm"
import { PostSessionForm } from "./PostSessionForm"
import { EveningCheckin } from "./EveningCheckin"
import { RaceForm } from "./RaceForm"

const forms = ["quick", "post-session", "evening", "race"] as const
type Form = (typeof forms)[number]
type Purpose = "PRIVATE_SELF_ONLY" | "ANALYZABLE_TRAINING_NOTE"
const fields = { "post-session": "훈련 메모 내용", evening: "오늘의 메모", race: "경기 메모" }
const syntheticMemo = "synthetic-form-fixture-042"
const oldWriters = () => [mocks.save, mocks.update, mocks.privateSave, mocks.privateUpdate]
const initialQuick = (purpose: Purpose, memo: string): PostSessionEntry => ({
  id: "existing-quick-fixture", kind: "post-session", date: "2026-09-08", savedAt: "2026-09-08T00:00:00.000Z",
  syncState: "local", system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  memo, memoPurpose: purpose,
})

function mount(form: Form, purpose?: Purpose, memo = syntheticMemo) {
  const onDone = vi.fn()
  if (form === "quick") render(<QuickSessionForm onDone={onDone}
    {...(purpose ? { initialEntry: initialQuick(purpose, memo) } : {})} />)
  else {
    const Component = form === "post-session" ? PostSessionForm : form === "evening" ? EveningCheckin : RaceForm
    render(<Component onDone={onDone} />)
    if (purpose) {
      fireEvent.change(screen.getByRole("textbox", { name: fields[form] }), { target: { value: memo } })
      fireEvent.click(screen.getByRole("radio", { name: purpose === "PRIVATE_SELF_ONLY" ? "나만의 메모" : "훈련 메모" }))
    }
  }
  return onDone
}
function saveButton(form: Form) {
  return screen.getByRole("button", { name: form === "quick" ? "오늘은 쉬었어요" : /^(저장|수정 저장)/ })
}
async function settle() { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }) }
async function complete(form: Form, done: ReturnType<typeof vi.fn>) {
  await settle()
  if (form === "quick") fireEvent.click(await screen.findByRole("button", { name: "완료" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
  return { entry: done.mock.calls[0]![form === "quick" ? 0 : 1] as JournalEntry,
    message: done.mock.calls[0]![form === "quick" ? 1 : 2] as string | undefined }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled = true
  mocks.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
  for (const writer of oldWriters()) writer.mockReturnValue({ ok: true })
  window.history.replaceState(null, "", "/?uitest=1")
})
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); vi.restoreAllMocks() })

describe.each(forms)("%s account-online form", form => {
  it.each(["ANALYZABLE_TRAINING_NOTE", "PRIVATE_SELF_ONLY"] as const)(
    "uses only the account writer for %s and labels an ACK accurately", async purpose => {
      const done = mount(form, purpose)
      fireEvent.click(saveButton(form))
      const result = await complete(form, done)
      expect(mocks.persist).toHaveBeenCalledOnce()
      expect(mocks.persist.mock.calls[0]![0]).toMatchObject({ memoPurpose: purpose,
        [form === "evening" ? "note" : "memo"]: syntheticMemo })
      expect(result.entry.syncState).toBe("synced")
      expect(result.message).toContain("계정에 저장했어요")
      expect(result.message).not.toContain("전송 대기")
      if (purpose === "PRIVATE_SELF_ONLY") expect(result.message).toContain("공유·분석에는 사용하지 않아요")
      for (const writer of oldWriters()) expect(writer).not.toHaveBeenCalled()
    },
  )

  it.each(["PENDING", "CONFLICT"] as const)("labels %s without a false account ACK, including private records", async storage => {
    mocks.persist.mockResolvedValue({ ok: true, storage })
    const done = mount(form, "PRIVATE_SELF_ONLY")
    fireEvent.click(saveButton(form))
    const result = await complete(form, done)
    expect(result.entry.syncState).toBe("local")
    expect(result.message).toContain(storage === "PENDING" ? "전송 대기" : "수정 충돌")
    expect(result.message).not.toContain("계정에 저장했어요")
    if (form === "quick") {
      expect(screen.getByLabelText(storage === "PENDING" ? "계정 전송 대기" : "수정 충돌")).toBeVisible()
      expect(screen.queryByText("계정에 저장됨")).toBeNull()
    }
    for (const writer of oldWriters()) expect(writer).not.toHaveBeenCalled()
  })

  it("serializes double taps and retains one new-form ID through failed retries", async () => {
    let finish!: (value: unknown) => void
    mocks.persist.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const done = mount(form)
    const button = saveButton(form)
    fireEvent.click(button); fireEvent.click(button)
    expect(mocks.persist).toHaveBeenCalledOnce()
    expect(done).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
    const firstId = mocks.persist.mock.calls[0]![0].id
    finish({ ok: false, storage: "FAILED" }); await settle()
    fireEvent.click(saveButton(form))
    await complete(form, done)
    expect(mocks.persist).toHaveBeenCalledTimes(2)
    expect(mocks.persist.mock.calls[1]![0].id).toBe(firstId)
    for (const writer of oldWriters()) expect(writer).not.toHaveBeenCalled()
  })

  it("keeps a successful new-form ID and uses its accepted savedAt for an explicit correction", async () => {
    const done = mount(form)
    fireEvent.click(saveButton(form)); await complete(form, done)
    const first = mocks.persist.mock.calls[0]![0] as JournalEntry
    if (form === "quick") fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(saveButton(form)); await settle()
    if (form === "quick") fireEvent.click(screen.getByRole("button", { name: "완료" }))
    expect(done).toHaveBeenCalledTimes(2)
    expect(mocks.persist.mock.calls[1]![0].id).toBe(first.id)
    expect(mocks.persist.mock.calls[1]![1]).toBe(first.savedAt)
    expect(mocks.persist.mock.calls[1]![0].savedAt > first.savedAt).toBe(true)
  })

  for (const purpose of ["ANALYZABLE_TRAINING_NOTE", "PRIVATE_SELF_ONLY"] as const) {
    it.each(["failure", "rejection", "missing-result"])(`keeps ${purpose} input and never falls back after %s`, async failure => {
      if (failure === "rejection") mocks.persist.mockRejectedValueOnce(new Error("synthetic transport failure"))
      else mocks.persist.mockResolvedValueOnce(failure === "missing-result" ? null : { ok: false, storage: "FAILED" })
      const done = mount(form, purpose)
      fireEvent.click(saveButton(form)); await settle()
      expect(done).not.toHaveBeenCalled()
      expect(screen.getByRole("alert")).toHaveTextContent("완료하지 못했어요")
      if (form !== "quick") expect(screen.getByRole("textbox", { name: fields[form] })).toHaveValue(syntheticMemo)
      fireEvent.click(saveButton(form)); await complete(form, done)
      expect(mocks.persist.mock.calls[1]![0]).toMatchObject({
        id: mocks.persist.mock.calls[0]![0].id, [form === "evening" ? "note" : "memo"]: syntheticMemo,
      })
      for (const writer of oldWriters()) expect(writer).not.toHaveBeenCalled()
    })
  }

  it.each([
    ["ACCOUNT", "달리다가 가슴이 조이고 숨을 못 쉬겠어", "안전과 관련된 표현이 감지됐어요"],
    ["PENDING", "무릎이 아파", "자동 확인을 완료하지 못했어요"],
  ])("retains D9 review attention alongside %s storage status", async (storage, memo, review) => {
    mocks.persist.mockResolvedValue({ ok: true, storage })
    const done = mount(form, "ANALYZABLE_TRAINING_NOTE", memo)
    fireEvent.click(saveButton(form))
    const result = await complete(form, done)
    expect(result.message).toContain(review)
    expect(result.message).toContain(storage === "ACCOUNT" ? "계정에 저장했어요" : "전송 대기")
    if (form === "quick") expect(screen.getByRole("status")).toHaveTextContent(review!)
  })

  it("does not log raw private memo text", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")]
    const done = mount(form, "PRIVATE_SELF_ONLY")
    fireEvent.click(saveButton(form)); await complete(form, done)
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(syntheticMemo)
  })
})
