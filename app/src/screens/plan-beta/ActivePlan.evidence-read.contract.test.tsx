import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-storage-keys"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { ActivePlan } from "./ActivePlan"

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const scrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo")
beforeEach(async () => {
  window.localStorage.clear()
  await initializeCanonicalJournalFixture()
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  for (const [prototype, key, descriptor] of [[HTMLDialogElement.prototype, "showModal", showModal], [Element.prototype, "scrollTo", scrollTo]] as const) {
    if (descriptor) Object.defineProperty(prototype, key, descriptor)
    else Reflect.deleteProperty(prototype, key)
  }
})

async function openFirstSessionEvidence() {
  const user = userEvent.setup()
  await user.click(within(screen.getByRole("group", { name: "계획 일정 보기" })).getByRole("button", { name: "목록" }))
  const list = screen.getByRole("list", { name: "날짜별 계획 미리보기" })
  expect(list).toBeVisible()
  const firstDay = within(list).getByRole("group", { name: "7월 24일 금요일 · 훈련 1개" })
  await user.click(within(firstDay).getByRole("button", { name: /전체 처방 보기$/u }))
  const reader = screen.getByRole("dialog")
  expect(within(reader).getByText("전체 20–30분 · 힘든 정도 2–4/10")).toBeVisible()
  await user.click(within(reader).getByRole("button", { name: "훈련 방법과 이유" }))
  await user.click(screen.getByRole("tab", { name: "주기·기록" }))
  return { user, reader }
}

async function closeEvidenceReaders({ user, reader }: Awaited<ReturnType<typeof openFirstSessionEvidence>>) {
  await user.click(screen.getByRole("button", { name: "훈련 일정으로 돌아가기" }))
  await waitFor(() => expect(screen.queryByRole("tab", { name: "주기·기록" })).not.toBeInTheDocument())
  await user.click(within(reader).getByRole("button", { name: "달력으로 돌아가기" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
}

it.each([null, "[]", "{broken", '[{"invalid":"entry"}]'])
  ("preserves complete versus unavailable journal evidence for %s", async raw => {
    if (raw !== null) localStorage.setItem(JOURNAL_STORAGE_KEY, raw)
    render(<ActivePlan state={stateFixture()} onProgress={vi.fn()} onNextFrame={vi.fn()}
      onActivateNextFrame={vi.fn()} onCheckDetailedExecution={vi.fn()} />)
    const readers = await openFirstSessionEvidence()
    const complete = raw === null || raw === "[]"
    expect(screen.queryByText(/이 훈련과 연결된 일지가 아직 없어요/u) !== null).toBe(complete)
    expect(screen.queryByText(/일지를 아직 모두 불러오지 못했어요/u) !== null).toBe(!complete)
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(raw)
    await closeEvidenceReaders(readers)
  })

it("does not turn a storage exception into an empty journal", async () => {
  const original = Storage.prototype.getItem
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === JOURNAL_STORAGE_KEY) throw new Error("synthetic storage failure")
    return original.call(this, key)
  })
  render(<ActivePlan state={stateFixture()} onProgress={vi.fn()} onNextFrame={vi.fn()}
    onActivateNextFrame={vi.fn()} onCheckDetailedExecution={vi.fn()} />)
  const readers = await openFirstSessionEvidence()
  expect(screen.getByText(/일지를 아직 모두 불러오지 못했어요/u)).toBeVisible()
  expect(screen.queryByText(/이 훈련과 연결된 일지가 아직 없어요/u)).toBeNull()
  await closeEvidenceReaders(readers)
})
