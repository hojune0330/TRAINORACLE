import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FullExportDialog } from "./FullExportDialog"
import { isBrowserPopNavigationConsumed } from "../../navigation/browserNavigation"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

function popTo(state: unknown) {
  window.history.replaceState(state, "", window.location.href)
  const event = new PopStateEvent("popstate", { state })
  fireEvent(window, event)
  return event
}

beforeEach(() => {
  setActiveLocalAccount(null)
  window.history.replaceState({ page: "synthetic-backup" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})

afterEach(async () => {
  cleanup()
  await Promise.resolve()
  popTo(null)
  vi.restoreAllMocks()
  setActiveLocalAccount(null)
})

function Harness({ confirm, close = vi.fn() }: { confirm: () => void; close?: () => void }) {
  const [open, setOpen] = React.useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>메모까지 백업</button>
    <button type="button">다른 백업 행동</button>
    {open && <FullExportDialog onClose={() => { close(); setOpen(false) }} onConfirm={confirm} />}
  </>
}

describe("full backup confirmation", () => {
  it("opens a native modal with cancel focused, traps Tab and returns focus after Escape without exporting", async () => {
    const user = userEvent.setup(), confirm = vi.fn()
    const show = vi.spyOn(HTMLDialogElement.prototype, "showModal")
    render(<Harness confirm={confirm} />)
    const opener = screen.getByRole("button", { name: "메모까지 백업" })
    await user.click(opener)
    const dialog = screen.getByRole("dialog", { name: "메모까지 포함할까요?" })
    expect(dialog.tagName).toBe("DIALOG")
    expect(show).toHaveBeenCalledOnce()
    expect(dialog).toHaveAccessibleDescription("이 파일에는 메모 원문과 메모 목적이 함께 들어가요. 받을 사람을 확인한 뒤 파일을 만들어요.")
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole("button", { name: "파일 만들기" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
    expect(confirm).not.toHaveBeenCalled()
    expect(window.history.back).toHaveBeenCalledOnce()
  })

  it("consumes browser Back to close only the confirmation and restores its opener", async () => {
    const confirm = vi.fn(), close = vi.fn(), parent = window.history.state
    render(<Harness confirm={confirm} close={close} />)
    const opener = screen.getByRole("button", { name: "메모까지 백업" })
    await userEvent.click(opener)
    const event = popTo(parent)
    expect(isBrowserPopNavigationConsumed(event)).toBe(true)
    expect(close).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })

  it.each(["cancel", "backdrop"] as const)("does not create a file when closed through %s", async method => {
    const confirm = vi.fn()
    render(<Harness confirm={confirm} />)
    await userEvent.click(screen.getByRole("button", { name: "메모까지 백업" }))
    if (method === "cancel") fireEvent.click(screen.getByRole("button", { name: "취소" }))
    else {
      const dialog = screen.getByRole("dialog")
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 240, 240))
      fireEvent.click(dialog, { clientX: 5, clientY: 5 })
    }
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it("keeps the confirmation open when its inner padding is clicked", async () => {
    const confirm = vi.fn()
    render(<Harness confirm={confirm} />)
    await userEvent.click(screen.getByRole("button", { name: "메모까지 백업" }))
    const dialog = screen.getByRole("dialog")
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 240, 240))
    fireEvent.click(dialog, { clientX: 25, clientY: 25 })
    expect(dialog).toBeVisible()
    expect(confirm).not.toHaveBeenCalled()
  })

  it("runs the file action once only after the explicit confirmation", async () => {
    const confirm = vi.fn()
    render(<Harness confirm={confirm} />)
    await userEvent.click(screen.getByRole("button", { name: "메모까지 백업" }))
    expect(confirm).not.toHaveBeenCalled()
    const action = screen.getByRole("button", { name: "파일 만들기" })
    fireEvent.click(action); fireEvent.click(action)
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("does not restore a previous account's focus after its scope changed", () => {
    setActiveLocalAccount("synthetic-backup-a")
    const opener = document.createElement("button")
    document.body.append(opener); opener.focus()
    const focus = vi.spyOn(opener, "focus")
    const view = render(<FullExportDialog onClose={vi.fn()} onConfirm={vi.fn()} />)
    act(() => { setActiveLocalAccount("synthetic-backup-b") })
    view.unmount()
    expect(focus).not.toHaveBeenCalled()
    opener.remove()
  })
})
