import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShellFrame } from "./AppShellFrame"
import { ShellToastHost } from "./ShellToastHost"

afterEach(cleanup)

function EditorFixture({ open }: { readonly open: boolean }) {
  return (
    <div role={open ? "dialog" : undefined} aria-modal={open ? "true" : undefined} aria-label="이 일지 꾸미기">
      <button type="button">꾸미기 편집기 닫기</button>
      <ShellToastHost active={open} />
      <div>일지 본문</div>
    </div>
  )
}

function renderShell(open: boolean, onDismissToast = vi.fn()) {
  return render(
    <AppShellFrame
      scrollRegionRef={React.createRef<HTMLElement>()}
      savedToast={{
        count: 1,
        phase: "enter",
        receipt: { kind: "generic", savedDate: "2026-09-12" },
        reviewMessage: "합성 검토 항목",
      }}
      tab="home"
      onDismissToast={onDismissToast}
      onOpenTrends={vi.fn()}
      onOpenBackup={vi.fn()}
      onTab={vi.fn()}
    >
      <EditorFixture open={open} />
    </AppShellFrame>,
  )
}

describe("AppShellFrame decoration editor toast host", () => {
  it("moves one persistent review alert inside the active modal", () => {
    renderShell(true)

    const editor = screen.getByRole("dialog", { name: "이 일지 꾸미기" })
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(within(editor).getByRole("alert")).toHaveAttribute("data-toast-priority", "review")
    expect(within(editor).getByRole("button", { name: "검토 안내 닫기" })).toBeVisible()
  })

  it("keeps the dismiss callback and active editor when closing the hosted alert", () => {
    const onDismissToast = vi.fn()
    renderShell(true, onDismissToast)

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "검토 안내 닫기" }))
    expect(onDismissToast).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog", { name: "이 일지 꾸미기" })).toBeInTheDocument()
  })

  it("keeps one external alert when the editor is closed", () => {
    renderShell(false)

    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector("[data-shell-toast-host]")).toBeNull()
  })
})
