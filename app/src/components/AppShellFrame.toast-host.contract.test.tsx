import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShellFrame, useInlineJournalSaveResult, type ShellToastState } from "./AppShellFrame"
import { ShellToastHost } from "./ShellToastHost"
import { JournalSaveResult } from "./JournalSaveResult"

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
        completionAlreadyShown: true,
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
  it("suppresses the duplicate toast only for a matching, confirmed inline save", () => {
    const result: ShellToastState = { count: 1, phase: "enter", completionAlreadyShown: true,
      receipt: { kind: "generic", savedDate: "2026-10-08" }, storageStatus: "CONFIRMED",
      reviewMessage: "합성 안전 검토 안내", rewardMessage: "포인트 확인 대기", rewardRetry: true }
    function InlineResult() {
      const host = useInlineJournalSaveResult("2026-10-08")
      return host?.result ? <JournalSaveResult result={host.result} onClose={vi.fn()} onRetryReward={host.onRetryReward} /> : null
    }
    const retry = vi.fn()
    const view = render(<AppShellFrame scrollRegionRef={React.createRef()} savedToast={result} tab="log"
      onDismissToast={vi.fn()} onOpenTrends={vi.fn()} onTab={vi.fn()} onRetryReward={retry}>
      <InlineResult />
    </AppShellFrame>)
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(document.querySelector("[data-toast-priority]")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
    expect(retry).toHaveBeenCalledTimes(1)
    view.rerender(<AppShellFrame scrollRegionRef={React.createRef()} savedToast={{ ...result, storageStatus: "PENDING" }} tab="log"
      onDismissToast={vi.fn()} onOpenTrends={vi.fn()} onTab={vi.fn()}>
      <InlineResult />
    </AppShellFrame>)
    expect(document.querySelector('[data-toast-priority="review"]')).not.toBeNull()
  })

  it("uses the wider result role only when a task does not already own the surface", () => {
    const props = { scrollRegionRef: React.createRef<HTMLElement>(), savedToast: null, tab: "home" as const,
      onDismissToast: vi.fn(), onOpenTrends: vi.fn(), onTab: vi.fn() }
    const view = render(<AppShellFrame {...props} wideResults><h1>합성 결과</h1></AppShellFrame>)
    expect(document.querySelector(".app-shell")).toHaveClass("app-shell--results")
    view.rerender(<AppShellFrame {...props} wideResults wideTask><h1>합성 결과</h1></AppShellFrame>)
    expect(document.querySelector(".app-shell")).toHaveClass("app-shell--task")
    expect(document.querySelector(".app-shell")).not.toHaveClass("app-shell--results")
  })

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
