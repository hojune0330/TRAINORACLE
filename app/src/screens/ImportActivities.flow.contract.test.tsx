import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { loadEntries } from "../domain/journal-store"
import { ImportActivities } from "./ImportActivities"
import { ReviewStage, SavedStage } from "./import-activities/ImportStages"
import type { ImportReviewSession } from "./ImportActivities"
import { localJournalScopeGeneration, setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const records = new File([JSON.stringify([
  { date: "2026-10-16", sport: "running", distanceKm: "2", durationMin: "10" },
  { date: "2026-10-16", sport: "running", distanceKm: "3", durationMin: "15" },
])], "synthetic.json", { type: "application/json" })

beforeEach(async () => {
  localStorage.clear()
  await initializeCanonicalJournalFixture()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("retains exact choices and excludes across file preparation, a failed replacement and resume without saving", async () => {
  const user = userEvent.setup()
  render(<ImportActivities />)
  await user.upload(screen.getByLabelText("가져올 운동 파일 선택"), records)
  const boxes = await screen.findAllByRole("checkbox")
  const choices = screen.getAllByRole("combobox", { name: /저장 방식/u })
  await user.selectOptions(choices[1]!, "exclude")
  await user.click(boxes[1]!)
  expect(choices[1]).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "다른 파일 고르기" }))
  await user.upload(screen.getByLabelText("가져올 운동 파일 선택"), new File(["<broken>"], "broken.tcx", { type: "application/xml" }))
  expect(await screen.findByTestId("import-failure")).toBeVisible()
  await user.click(screen.getByRole("button", { name: "확인하던 운동 2건 이어보기" }))
  expect(screen.getAllByRole("checkbox")[0]).toBeChecked()
  expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked()
  const retained = screen.getAllByRole("combobox", { name: /저장 방식/u })[1]!
  expect(retained).toHaveValue("exclude")
  expect(document.querySelector(".import-review__intent")).toHaveTextContent("이번 가져오기에서 제외")
  expect(retained).toBeDisabled()
  await user.click(screen.getAllByRole("checkbox")[1]!)
  expect(retained).toBeEnabled()
  expect(screen.getByRole("button", { name: "1건 저장 · 1건 제외" })).toBeEnabled()
  expect(loadEntries()).toEqual([])
})

it("separates device storage from account confirmation and offers read-only review after partial failure", async () => {
  const user = userEvent.setup(), review = vi.fn(), summary = vi.fn()
  const view = render(<SavedStage outcome={{ saved: 1, failed: 1, total: 1 }} onReview={review} onOpenSummary={summary} onRestart={vi.fn()} />)
  expect(screen.getByText("이 브라우저에 저장했어요. 계정에 동기화되지는 않아요.")).toBeVisible()
  expect(screen.queryByText("계정에 저장됨")).toBeNull()
  await user.click(screen.getByRole("button", { name: "원래 파일 다시 검토" }))
  expect(review).toHaveBeenCalledOnce()
  expect(summary).not.toHaveBeenCalled()
  view.rerender(<SavedStage outcome={{ saved: 0, failed: 1, total: 0 }} onReview={review} onRestart={vi.fn()} />)
  expect(screen.queryByText("이 브라우저에 저장했어요. 계정에 동기화되지는 않아요.")).toBeNull()
})

it("does not label a device write as account confirmation", () => {
  render(<ReviewStage busy drafts={[]} result={{ activities: [], format: "json", skipped: 0 }} selected={new Set()} intents={new Map()}
    onIntent={vi.fn()} onToggle={vi.fn()} onSave={vi.fn()} onRestart={vi.fn()} />)
  expect(screen.getByRole("status")).toHaveTextContent("이 브라우저에 저장 중")
  expect(screen.queryByText("계정 저장 확인 중")).toBeNull()
})

it("restores a same-scope review across unmounts but refuses an A-B-A lifetime", async () => {
  const user = userEvent.setup()
  const session: ImportReviewSession = { scope: localJournalScopeGeneration(), review: null, position: null }
  const first = render(<ImportActivities reviewSession={session} />)
  await user.upload(screen.getByLabelText("가져올 운동 파일 선택"), records)
  const choices = await screen.findAllByRole("combobox", { name: /저장 방식/u })
  await user.selectOptions(choices[1]!, "exclude")
  await user.click(screen.getAllByRole("checkbox")[1]!)
  first.unmount()
  const restored = render(<ImportActivities reviewSession={session} />)
  expect(screen.getAllByRole("checkbox")[0]).toBeChecked()
  expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked()
  expect(screen.getAllByRole("combobox", { name: /저장 방식/u })[1]).toHaveValue("exclude")
  restored.unmount()
  setActiveLocalAccount("synthetic-other")
  setActiveLocalAccount(null)
  render(<ImportActivities reviewSession={session} />)
  expect(screen.queryByTestId("import-draft-row")).toBeNull()
  expect(loadEntries()).toEqual([])
})
