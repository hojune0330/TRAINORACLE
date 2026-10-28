import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-schema"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { EveningCheckin } from "../log-entry/EveningCheckin"
import { Home } from "../Home"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"

const mock = vi.hoisted(() => ({ save: vi.fn() }))
// Exercise the real form's continuation against deterministic finalization
// outcomes. No server, account data or draft-storage transport is used here.
vi.mock("../../domain/account/account-journal-record-service", async original => ({
  ...await original<typeof import("../../domain/account/account-journal-record-service")>(), accountJournalRecordsEnabled: () => true,
}))
vi.mock("../../domain/account/account-journal-api", async original => ({
  ...await original<typeof import("../../domain/account/account-journal-api")>(), accountJournalPreviewEnabled: () => false,
}))
vi.mock("../log-entry/useFormFinalization", () => ({ useFormFinalization: () => ({ save: mock.save }), FormFinalizationRecovery: () => null }))
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null); mock.save.mockReset() })
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })
function fill() {
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 저장 스냅샷" } })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
}
function deferredSave() {
  let finish!: (value: unknown) => void
  mock.save.mockImplementation((entry: JournalEntry) => new Promise(resolve => { finish = result => resolve({ ...(result as object), entry }) }))
  return (result: unknown) => act(async () => { finish(result); await Promise.resolve() })
}

it.each(["PENDING", "CONFLICT"] as const)("keeps %s input unfinished and retryable without a receipt", async storage => {
  mock.save.mockImplementation(async (entry: JournalEntry) => ({ ok: true, storage, entry }))
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fill(); fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("기록 미완료"))
  expect(screen.getByRole("alert")).toHaveFocus()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 저장 스냅샷")
  expect(done).not.toHaveBeenCalled()
})

it.each(["rejected", "thrown"])("focuses a %s Home save error while preserving input for a retry", async outcome => {
  if (outcome === "thrown") mock.save.mockRejectedValueOnce(new Error("synthetic transport failure"))
  else mock.save.mockResolvedValueOnce({ ok: false, notice: "합성 저장 실패" })
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).not.toHaveFocus()
  fill(); fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus())
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 저장 스냅샷")
  expect(done).not.toHaveBeenCalled()
  const input = screen.getByRole("textbox", { name: "오늘의 메모" })
  input.focus()
  fireEvent.change(input, { target: { value: "합성 재시도 입력" } })
  expect(input).toHaveFocus()
  mock.save.mockImplementation(async (entry: JournalEntry) => ({ ok: true, storage: "ACCOUNT", entry }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
})

it("accepts one explicit save while a delayed acknowledgement is in flight", async () => {
  const finish = deferredSave(), done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fill()
  const save = screen.getByRole("button", { name: "저장" })
  fireEvent.click(save); fireEvent.click(save)
  expect(mock.save).toHaveBeenCalledOnce()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toBeDisabled()
  await finish({ ok: true, storage: "ACCOUNT" })
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
})

it("does not clear accepted newer input or show completion after a late old acknowledgement", async () => {
  const finish = deferredSave(), done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fill(); fireEvent.click(screen.getByRole("button", { name: "저장" }))
  // Equivalent failure input for a queued change accepted after submission.
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 나중 입력" } })
  await finish({ ok: true, storage: "ACCOUNT" })
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("작성 중 내용이 바뀌었어요"))
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 나중 입력")
  expect(done).not.toHaveBeenCalled()
  expect(mock.save.mock.calls[0]?.[0]).toMatchObject({ note: "합성 저장 스냅샷" })
})

it("does not credit an old account continuation after a scope change", async () => {
  const finish = deferredSave(), done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fill(); fireEvent.click(screen.getByRole("button", { name: "저장" }))
  act(() => setActiveLocalAccount("synthetic-new-memo-owner"))
  await finish({ ok: true, storage: "ACCOUNT" })
  expect(done).not.toHaveBeenCalled()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
})

it("does not reset Home or credit a late acknowledgement after A to B to A", async () => {
  const finish = deferredSave(), done = vi.fn(), leave = vi.fn()
  render(<Home onJournalSaved={done} />)
  fill(); fireEvent.click(screen.getByRole("button", { name: "저장" }))
  expect(runDraftSafeNavigation(leave)).toBe(false)
  act(() => { setActiveLocalAccount("synthetic-temporary-owner"); setActiveLocalAccount(null) })
  await finish({ ok: true, storage: "ACCOUNT" })
  expect(done).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "최근 저장한 기록 보기" })).toBeNull()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
})
