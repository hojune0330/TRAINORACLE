import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { AppShellFrame, type ShellToastState } from "./AppShellFrame"
import { JournalSaveResult } from "./JournalSaveResult"
import { registerBrowserBackLayer } from "../navigation/browserNavigation"

vi.mock("../navigation/browserNavigation", async importOriginal => ({
  ...await importOriginal<typeof import("../navigation/browserNavigation")>(),
  registerBrowserBackLayer: vi.fn((options: { onClose: () => void }) => ({ close: options.onClose, dispose: vi.fn() })),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

const saved: ShellToastState = { count: 1, phase: "enter", receipt: { kind: "generic", savedDate: "2026-10-08" },
  rewardMessage: "오늘 기록 포인트가 반영됐어요." }

function frame(result: ShellToastState | null, onClose = vi.fn(), extras: Partial<React.ComponentProps<typeof AppShellFrame>> = {}) {
  return <AppShellFrame scrollRegionRef={React.createRef()} tab="home" savedToast={result} onDismissToast={onClose}
    onOpenTrends={vi.fn()} onTab={vi.fn()} onOpenSaved={vi.fn()} onDecorateSaved={vi.fn()} {...extras}>
    <label>출발 화면 입력<input defaultValue="합성 초안" /></label>
  </AppShellFrame>
}

describe("journal save completion", () => {
  it("lets an embedded completion keep its existing browser-back owner", () => {
    const close = vi.fn()
    render(<JournalSaveResult result={saved} onClose={close} closeLabel="완료" manageBrowserBack={false} />)
    expect(registerBrowserBackLayer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "완료" }))
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("shows a dated result alone, preserving the underlying screen until explicitly closed", () => {
    const close = vi.fn(), open = vi.fn(), decorate = vi.fn()
    const view = render(frame(saved, close, { onOpenSaved: open, onDecorateSaved: decorate }))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "주 탭" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /기록을 남겼어요/ })).toBeInTheDocument()
    const art = document.querySelector('img[src$="journal-saved-v2.webp"]')
    expect(art).toHaveAttribute("alt", "")
    fireEvent.error(art!)
    expect(document.querySelector('img[src$="journal-saved-v2.webp"]')).toBeNull()
    expect(screen.getByRole("heading", { name: /기록을 남겼어요/ })).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
    expect(decorate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    expect(decorate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "닫기" }))
    expect(close).toHaveBeenCalledTimes(1)
    view.rerender(frame(null))
    expect(screen.getByRole("textbox", { name: "출발 화면 입력" })).toHaveValue("합성 초안")
    expect(screen.getByRole("navigation", { name: "주 탭" })).toBeInTheDocument()
  })

  it("keeps pending storage and reward confirmation separate; retry only calls the read action", () => {
    const retry = vi.fn(), open = vi.fn()
    render(frame({ ...saved, storageMessage: "기기 보관 · 계정 전송 대기", rewardMessage: "포인트 확인이 필요해요.", rewardRetry: true },
      vi.fn(), { onRetryReward: retry, onOpenSaved: open }))
    expect(screen.getByRole("heading", { name: "기기 보관 · 계정 전송 대기" })).toBeInTheDocument()
    expect(document.querySelector('img[src$="journal-saved-v2.webp"]')).toBeNull()
    expect(screen.queryByRole("heading", { name: /저장됐어요|기록을 남겼어요/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).not.toHaveTextContent("반영됐어요")
  })

  it("keeps review alerts visible without promoting decoration ahead of review", () => {
    render(frame({ ...saved, reviewMessage: "확인이 필요한 기록이에요." }))
    expect(screen.getByRole("alert")).toHaveTextContent("확인이 필요한 기록이에요.")
    expect(document.querySelector('img[src$="journal-saved-v2.webp"]')).toBeNull()
    expect(screen.queryByRole("button", { name: "일지 꾸미기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "기록 보기" })).toBeInTheDocument()
  })

  it("uses the explicit confirmed outcome even when an account storage notice is present", () => {
    render(frame({ ...saved, storageStatus: "CONFIRMED", storageMessage: "일지를 계정에 저장했어요." }))
    expect(screen.getByRole("heading", { name: "일지를 계정에 저장했어요." })).toBeVisible()
    expect(document.querySelector('.journal-save-result')).toHaveAttribute("data-storage-state", "confirmed")
  })

  it("does not turn an undated notification into a blocking result screen", () => {
    render(frame({ ...saved, receipt: { kind: "generic" } }))
    expect(screen.getByRole("textbox")).toBeVisible()
    expect(screen.getByRole("navigation", { name: "주 탭" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "저장 안내 닫기" })).toBeInTheDocument()
  })

  it("does not show a second full result after QuickSession already confirmed the save", () => {
    const retry = vi.fn()
    render(frame({ ...saved, completionAlreadyShown: true, rewardRetry: true }, vi.fn(), { onRetryReward: retry }))
    expect(screen.getByRole("textbox")).toBeVisible()
    expect(screen.queryByRole("heading", { name: /기록을 남겼어요/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "포인트 다시 확인" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
