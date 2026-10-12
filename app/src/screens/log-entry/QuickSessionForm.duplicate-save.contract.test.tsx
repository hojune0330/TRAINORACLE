import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppShellFrame, type ShellToastState } from "../../components/AppShellFrame"
import { createSavedFactReceipt } from "../../domain/save-receipt"
import { loadEntries } from "../../domain/journal-store"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { QuickSessionForm } from "./QuickSessionForm"

describe("quick RESTED duplicate-save boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("stores one record and emits one save result when the final action is clicked twice synchronously", async () => {
    const savedCallbacks: PostSessionEntry[] = []
    const retryReward = vi.fn()

    function Fixture() {
      const [result, setResult] = React.useState<ShellToastState | null>(null)
      return <AppShellFrame scrollRegionRef={React.createRef()} tab="log" savedToast={result}
        onDismissToast={() => setResult(null)} onOpenTrends={vi.fn()} onTab={vi.fn()}
        onRetryReward={retryReward} hideTabBar>
        <QuickSessionForm onSaved={entry => {
          savedCallbacks.push(entry)
          setResult({ count: savedCallbacks.length, phase: "enter", receipt: createSavedFactReceipt(entry),
            completionAlreadyShown: true, storageStatus: "CONFIRMED",
            rewardMessage: "합성 포인트 확인이 필요해요.", rewardRetry: true })
        }} />
      </AppShellFrame>
    }

    render(<Fixture />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    const save = screen.getByRole("button", { name: "이대로 저장" })
    act(() => {
      save.click()
      save.click()
    })

    await screen.findByRole("button", { name: "완료" })
    const entries = loadEntries()
    const ids = entries.map(entry => entry.id)
    expect.soft(entries).toHaveLength(1)
    expect.soft(ids).toEqual([savedCallbacks[0]?.id])
    expect.soft(new Set(ids).size).toBe(1)
    expect.soft(entries[0]).toMatchObject({ activityOutcome: "RESTED", rpe: 0 })
    expect.soft(savedCallbacks).toHaveLength(1)
    expect.soft(document.querySelectorAll(".journal-save-result")).toHaveLength(1)
    expect.soft(screen.getAllByText("합성 포인트 확인이 필요해요.")).toHaveLength(1)
    expect.soft(retryReward).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
    expect(retryReward).toHaveBeenCalledTimes(1)
  })

  it("releases the successful-save lock for one deliberate correction to the same record", async () => {
    const onSaved = vi.fn()
    render(<QuickSessionForm onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    await screen.findByRole("button", { name: "완료" })

    const [before] = loadEntries()
    expect(loadEntries()).toHaveLength(1)
    expect(before).toMatchObject({ activityOutcome: "RESTED" })
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: before?.id, activityOutcome: "RESTED" }), undefined, undefined)

    fireEvent.click(screen.getByText("내용 추가·수정"))
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "하려던 운동을 건너뛰었어요" }))
    fireEvent.click(screen.getByRole("button", { name: "이대로 저장" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))

    const after = loadEntries()
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: before?.id, activityOutcome: "SKIPPED" })
    expect(Date.parse(after[0]!.savedAt)).toBeGreaterThan(Date.parse(before!.savedAt))
    expect(onSaved.mock.calls.map(([entry]) => entry.id)).toEqual([before?.id, before?.id])
  })
})
