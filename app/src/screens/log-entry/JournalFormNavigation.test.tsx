import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { beginBrowserPopNavigation, hasPendingBrowserBackLayer } from "../../navigation/browserNavigation"
import { registerUnsavedDraftGuard } from "../../domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

const writes = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock("../../domain/account/account-journal-record-service", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/account-journal-record-service")>(),
  accountJournalRecordsEnabled: () => false,
}))
vi.mock("../../domain/account/account-journal-api", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/account-journal-api")>(),
  accountJournalPreviewEnabled: () => false,
}))
vi.mock("../../domain/journal-store", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/journal-store")>(),
  saveEntry: (...args: unknown[]) => writes.save(...args),
}))
import { EveningCheckin } from "./EveningCheckin"
import { QuickSessionForm } from "./QuickSessionForm"

const originState = { syntheticJournalOrigin: true }
const targetDate = "2026-10-14"

// Own the timing of native POP in jsdom: a requested Back must not count as
// completed navigation until the browser has actually delivered its target.
async function popTo(state: unknown) {
  await act(async () => {
    window.history.replaceState(state, "", window.location.href)
    beginBrowserPopNavigation()
    window.dispatchEvent(new PopStateEvent("popstate", { state }))
    await Promise.resolve()
  })
}

function openExit() {
  const returnState = window.history.state
  const trigger = screen.getByRole("button", { name: "나가기" })
  trigger.focus()
  fireEvent.click(trigger)
  return { returnState, trigger, dialog: screen.getByRole("dialog", { name: "작성 중인 기록을 저장할까요?" }) }
}

function chooseMood() {
  fireEvent.click(screen.getByRole("button", { name: "기분" }))
  fireEvent.click(screen.getByRole("button", { name: "기분 4 좋음" }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  writes.save.mockReset().mockReturnValue({ ok: true })
  window.history.replaceState(originState, "", "/")
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
  vi.spyOn(window.history, "forward").mockImplementation(() => undefined)
})

afterEach(async () => {
  cleanup()
  await act(async () => { await Promise.resolve() })
  await popTo(originState)
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe("journal form departure", () => {
  it("keeps Back within the evening steps and preserves input after continue-writing and native Escape cancellation", async () => {
    const onBack = vi.fn(), onExit = vi.fn(), onDone = vi.fn()
    render(<EveningCheckin targetDate={targetDate} onBack={onBack} onExit={onExit} onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "수면" }))
    fireEvent.change(screen.getByRole("textbox", { name: "수면 시간" }), { target: { value: "6.5" } })
    fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
    fireEvent.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(screen.getByRole("heading", { name: "어젯밤 수면" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toHaveValue("6.5")
    expect(onBack).not.toHaveBeenCalled()

    const first = openExit()
    fireEvent.click(within(first.dialog).getByRole("button", { name: "계속 작성하기" }))
    await popTo(first.returnState)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toHaveValue("6.5")
    expect(first.trigger).toHaveFocus()

    const second = openExit()
    // Escape emits the native cancel event; jsdom does not synthesize it from keydown.
    fireEvent(second.dialog, new Event("cancel", { bubbles: false, cancelable: true }))
    await popTo(second.returnState)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toHaveValue("6.5")
    expect(second.trigger).toHaveFocus()
    expect(onBack).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(writes.save).not.toHaveBeenCalled()
  })

  it("uses native Back to cancel only the exit dialog without losing the current question or answer", async () => {
    const onExit = vi.fn()
    render(<EveningCheckin targetDate={targetDate} onExit={onExit} />)
    chooseMood()
    const exit = openExit()
    window.history.back()
    await popTo(exit.returnState)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("heading", { name: "오늘 기분" })).toBeVisible()
    expect(screen.getByRole("button", { name: "기분 4 좋음" })).toHaveAttribute("aria-pressed", "true")
    expect(exit.trigger).toHaveFocus()
    expect(onExit).not.toHaveBeenCalled()
    expect(writes.save).not.toHaveBeenCalled()
    expect(hasPendingBrowserBackLayer()).toBe(false)
  })

  it("does not bypass another storage guard on discard and exits once only after the form Back sentinel drains", async () => {
    const onExit = vi.fn(), blocked = vi.fn()
    let unsafe = true
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: blocked })
    try {
      render(<EveningCheckin targetDate={targetDate} onExit={onExit} />)
      chooseMood()
      const first = openExit()
      fireEvent.click(within(first.dialog).getByRole("button", { name: "저장 없이 나가기" }))
      await popTo(first.returnState)
      expect(blocked).toHaveBeenCalledOnce()
      expect(onExit).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "기분 4 좋음" })).toHaveAttribute("aria-pressed", "true")
      expect(writes.save).not.toHaveBeenCalled()

      unsafe = false
      const second = openExit()
      fireEvent.click(within(second.dialog).getByRole("button", { name: "저장 없이 나가기" }))
      await popTo(second.returnState)
      await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(true))
      expect(onExit).not.toHaveBeenCalled()
      await popTo(originState)
      expect(onExit).toHaveBeenCalledOnce()
      expect(hasPendingBrowserBackLayer()).toBe(false)
      await popTo(originState)
      expect(onExit).toHaveBeenCalledOnce()
      expect(writes.save).not.toHaveBeenCalled()
    } finally { unregister() }
  })

  it("saves the explicit answers before calling Done once and waits for native Back to finish", async () => {
    const onExit = vi.fn(), onDone = vi.fn()
    render(<EveningCheckin targetDate={targetDate} onExit={onExit} onDone={onDone} />)
    chooseMood()
    const exit = openExit()
    fireEvent.click(within(exit.dialog).getByRole("button", { name: "저장하고 나가기" }))
    expect(writes.save).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    await popTo(exit.returnState)
    expect(writes.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      kind: "evening", date: targetDate, mood: 4, sleepH: 0, painParts: {},
      fieldProvenance: expect.objectContaining({ sleepH: { provenance: "MISSING" } }),
    }))
    await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(true))
    expect(onDone).not.toHaveBeenCalled()
    await popTo(originState)
    expect(onDone).toHaveBeenCalledExactlyOnceWith("evening", expect.objectContaining({ date: targetDate, mood: 4 }), undefined)
    expect(onExit).not.toHaveBeenCalled()
    await popTo(originState)
    expect(onDone).toHaveBeenCalledOnce()
    expect(writes.save).toHaveBeenCalledOnce()
  })

  it("keeps the answer and visible retry error when save-and-exit cannot persist", async () => {
    writes.save.mockReturnValue({ ok: false })
    const onExit = vi.fn(), onDone = vi.fn()
    render(<EveningCheckin targetDate={targetDate} onExit={onExit} onDone={onDone} />)
    chooseMood()
    const exit = openExit()
    fireEvent.click(within(exit.dialog).getByRole("button", { name: "저장하고 나가기" }))
    await popTo(exit.returnState)
    expect(writes.save).toHaveBeenCalledOnce()
    expect(screen.getByRole("alert")).toHaveTextContent("저장을 완료하지 못했어요")
    expect(screen.getByText("기분 좋음")).toBeVisible()
    expect(screen.getByRole("button", { name: /^저장/ })).toBeEnabled()
    expect(hasPendingBrowserBackLayer()).toBe(false)
    expect(onExit).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "기분 수정" }))
    expect(screen.getByRole("button", { name: "기분 4 좋음" })).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps an incomplete quick record on its unanswered question instead of saving or leaving", async () => {
    const onExit = vi.fn(), onDone = vi.fn(), onSaved = vi.fn()
    render(<QuickSessionForm targetDate={targetDate} onExit={onExit} onDone={onDone} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    const exit = openExit()
    fireEvent.click(within(exit.dialog).getByRole("button", { name: "저장하고 나가기" }))
    await popTo(exit.returnState)
    expect(screen.getByRole("heading", { name: "언제 했나요?" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("아직 답하지 않은 항목")
    expect(screen.getByRole("button", { name: "오후" })).toBeEnabled()
    expect(writes.save).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
    expect(hasPendingBrowserBackLayer()).toBe(false)
  })

  it("protects a guest's invalid sleep-only input and returns validation focus instead of leaving", async () => {
    const onExit = vi.fn(), onDone = vi.fn()
    render(<EveningCheckin targetDate={targetDate} onExit={onExit} onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "수면" }))
    const sleep = screen.getByRole("textbox", { name: "수면 시간" })
    fireEvent.change(sleep, { target: { value: "25" } })
    const unload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    const exit = openExit()
    expect(exit.dialog).toHaveTextContent("저장 없이 나가면 입력한 내용은 사라져요.")
    fireEvent.click(within(exit.dialog).getByRole("button", { name: "저장하고 나가기" }))
    await popTo(exit.returnState)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(sleep).toHaveValue("25")
    expect(sleep).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("최대 24시간")
    await waitFor(() => expect(sleep).toHaveFocus())
    expect(writes.save).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
