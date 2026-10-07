import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { JournalConfirmationDialog } from "./JournalConfirmationDialog"
import { beginBrowserPopNavigation, consumeBrowserBackLayer, registerBrowserBackLayer } from "../navigation/browserNavigation"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { JournalDecorationSurface } from "../screens/journal/JournalDecorationSurface"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
  window.history.replaceState({ parent: "synthetic-screen" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
  vi.spyOn(window.history, "forward").mockImplementation(() => undefined)
})
afterEach(async () => {
  cleanup()
  await Promise.resolve()
  // The mock Back does not dispatch a native event. Drain the disposed layer's
  // queued departure before resetting the next synthetic browser context.
  popTo(null)
  vi.restoreAllMocks()
  localStorage.clear()
  setActiveLocalAccount(null)
})

function Harness({ cancel, confirm, editor = false }: {
  readonly cancel: () => void
  readonly confirm: () => boolean | Promise<boolean>
  readonly editor?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return <>
    {editor && <JournalDecorationSurface date="2026-10-02" initiallyOpen hasEntries><article>synthetic journal</article></JournalDecorationSurface>}
    <button data-testid="open-confirmation" onClick={() => setOpen(true)}>open confirmation</button>
    {open && <JournalConfirmationDialog title="synthetic confirmation" description="synthetic action"
      confirmLabel="explicit confirmation" onCancel={() => { cancel(); setOpen(false) }} onConfirm={confirm} />}
  </>
}

function popTo(state: unknown): void {
  window.history.replaceState(state, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state }))
}

describe("confirmation native navigation", () => {
  it("does not return an old owner's focus when account scope changes before dialog cleanup", () => {
    vi.useFakeTimers()
    setActiveLocalAccount("synthetic-dialog-owner-a")
    const opener = document.createElement("button")
    document.body.append(opener)
    const openerFocus = vi.spyOn(opener, "focus")
    const { unmount } = render(<JournalConfirmationDialog title="synthetic owner focus" description="synthetic"
      confirmLabel="confirm" onCancel={vi.fn()} onConfirm={() => false} returnFocusTo={() => opener} />)
    setActiveLocalAccount("synthetic-dialog-owner-b")
    unmount()
    act(() => { vi.advanceTimersByTime(1) })
    expect(opener.isConnected).toBe(true)
    expect(openerFocus).not.toHaveBeenCalled()
    opener.remove()
    vi.useRealTimers()
  })

  it("restores focus during cleanup without a delayed return that can steal a newly opened layer's focus", async () => {
    vi.useFakeTimers()
    const opener = document.createElement("button")
    document.body.append(opener)
    const openerFocus = vi.spyOn(opener, "focus")
    const { unmount } = render(<JournalConfirmationDialog title="synthetic focus" description="synthetic"
      confirmLabel="confirm" onCancel={vi.fn()} onConfirm={() => false} returnFocusTo={() => opener} />)
    unmount()
    expect(openerFocus).toHaveBeenCalledOnce()
    const next = registerBrowserBackLayer({ id: "synthetic-focus-new", canClose: () => true, onClose: vi.fn() })
    act(() => { vi.advanceTimersByTime(1) })
    expect(openerFocus).toHaveBeenCalledOnce()
    next.dispose()
    await Promise.resolve()
    opener.remove()
    vi.useRealTimers()
  })

  it("does not restore old focus when another top layer already owns focus at cleanup", async () => {
    const opener = document.createElement("button")
    document.body.append(opener)
    const openerFocus = vi.spyOn(opener, "focus")
    const { unmount } = render(<JournalConfirmationDialog title="synthetic covered focus" description="synthetic"
      confirmLabel="confirm" onCancel={vi.fn()} onConfirm={() => false} returnFocusTo={() => opener} />)
    const next = registerBrowserBackLayer({ id: "synthetic-covered-new", canClose: () => true, onClose: vi.fn() })
    unmount()
    expect(openerFocus).not.toHaveBeenCalled()
    next.dispose()
    await Promise.resolve()
    opener.remove()
  })

  it("closes only the confirmation on Back, not its parent or the open decoration drawer", () => {
    const cancel = vi.fn(), confirm = vi.fn(() => true), parentLeave = vi.fn()
    render(<Harness cancel={cancel} confirm={confirm} editor />)
    fireEvent.click(screen.getByRole("button", { name: "꾸미기 재료 도구" }))
    const parentState = window.history.state
    fireEvent.click(screen.getByTestId("open-confirmation"))
    const shellPop = (event: PopStateEvent) => {
      beginBrowserPopNavigation()
      if (!consumeBrowserBackLayer(event)) parentLeave()
    }
    window.addEventListener("popstate", shellPop)
    try { popTo(parentState) }
    finally { window.removeEventListener("popstate", shellPop) }
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(parentLeave).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("button", { name: "재료 서랍 숨기기" })).toBeVisible()
    expect(window.history.state.journalDecorationEditor).toBe(parentState.journalDecorationEditor)
  })

  it("gives Escape and Tab to the confirmation without closing the editor drawer", () => {
    const cancel = vi.fn()
    render(<Harness cancel={cancel} confirm={() => true} editor />)
    fireEvent.click(screen.getByRole("button", { name: "꾸미기 재료 도구" }))
    fireEvent.click(screen.getByTestId("open-confirmation"))
    const confirmButton = screen.getByTestId("journal-delete-confirm")
    fireEvent.keyDown(screen.getByTestId("journal-delete-cancel"), { key: "Tab", shiftKey: true })
    expect(confirmButton).toHaveFocus()
    fireEvent.keyDown(confirmButton, { key: "Escape" })
    expect(cancel).toHaveBeenCalledOnce()
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("button", { name: "재료 서랍 숨기기" })).toBeVisible()
    expect(window.history.back).toHaveBeenCalledOnce()
  })

  it("blocks Back during an in-flight confirmation and allows cancellation only after failure", async () => {
    let finish!: (value: boolean) => void
    const cancel = vi.fn(), confirm = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
    render(<Harness cancel={cancel} confirm={confirm} />)
    const parentState = window.history.state
    fireEvent.click(screen.getByTestId("open-confirmation"))
    const dialogState = window.history.state
    fireEvent.click(screen.getByTestId("journal-delete-confirm"))
    popTo(parentState)
    expect(cancel).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByRole("alertdialog")).toBeVisible()
    expect(window.history.forward).toHaveBeenCalledOnce()
    popTo(dialogState)
    await act(async () => { finish(false) })
    popTo(parentState)
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole("alertdialog")).toBeNull()
    popTo(dialogState)
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("keeps an underlying text-sheet draft when Escape dismisses the top confirmation", () => {
    const cancel = vi.fn(), confirm = vi.fn(() => true)
    render(<Harness cancel={cancel} confirm={confirm} editor />)
    fireEvent.click(screen.getByRole("button", { name: "글 스티커 도구" }))
    const input = screen.getByTestId("journal-text-sticker-input")
    fireEvent.change(input, { target: { value: "synthetic draft" } })
    fireEvent.click(screen.getByTestId("open-confirmation"))
    fireEvent.keyDown(screen.getByTestId("journal-delete-cancel"), { key: "Escape" })
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByTestId("journal-text-sticker-input")).toHaveValue("synthetic draft")
    expect(screen.getByRole("dialog", { name: "글 스티커 만들기" })).toBeVisible()
  })
})
