import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { PostSessionEntry } from "../domain/journal-store"

const mocks = vi.hoisted(() => ({ enabled: true, persist: vi.fn() }))
vi.mock("../domain/account/account-journal-record-service", () => ({
  accountJournalRecordsEnabled: () => mocks.enabled,
  persistAccountJournalRecord: (...args: unknown[]) => mocks.persist(...args),
}))
import { LogEntry } from "./LogEntry"

const initial: PostSessionEntry = { id: "quick-review-fixture", kind: "post-session", date: "2026-09-08",
  savedAt: "2026-09-08T00:00:00.000Z", syncState: "local", system: "", title: "", distanceKm: "",
  durationMin: "", avgPace: "", rpe: 0, memo: "무릎이 아파", memoPurpose: "ANALYZABLE_TRAINING_NOTE" }

beforeEach(() => { mocks.enabled = true; vi.clearAllMocks(); window.localStorage.clear() })
afterEach(cleanup)

it.each(["ACCOUNT", "PENDING", "CONFLICT"] as const)("completes Quick only after ACCOUNT acknowledgement, starting with %s", async storage => {
  mocks.persist.mockResolvedValue({ ok: true, storage })
  const onDone = vi.fn()
  render(<LogEntry entryType="quick-session" initialEntry={initial} onDone={onDone} />)
  fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  if (storage !== "ACCOUNT") {
    const notice = await screen.findByText(storage === "PENDING" ? /계정 전송 대기 중이에요/ : /수정 충돌을 확인해 주세요/)
    expect(notice.textContent).toContain("기록 완료는 아직이에요")
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "완료" })).not.toBeInTheDocument()
    expect(mocks.persist).toHaveBeenLastCalledWith(expect.objectContaining({
      id: initial.id, memo: initial.memo, activityOutcome: "RESTED",
    }), expect.anything())
    mocks.persist.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  }
  const complete = await screen.findByRole("button", { name: "완료" })
  const message = screen.getByRole("status").textContent
  fireEvent.click(complete)
  expect(onDone).toHaveBeenCalledExactlyOnceWith("post-session", expect.objectContaining({
    id: initial.id, syncState: "synced", memo: initial.memo, activityOutcome: "RESTED",
  }), message)
  expect(message).toContain("자동 확인을 완료하지 못했어요")
  expect(message).toContain("계정에 저장했어요")
})

it("preserves the two-argument classic callback when Quick has no review message", () => {
  mocks.enabled = false
  const onDone = vi.fn()
  render(<LogEntry entryType="quick-session" onDone={onDone} />)
  fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
  fireEvent.click(screen.getByRole("button", { name: "완료" }))
  expect(onDone).toHaveBeenCalledExactlyOnceWith("post-session", expect.objectContaining({ syncState: "local" }))
  expect(mocks.persist).not.toHaveBeenCalled()
})
