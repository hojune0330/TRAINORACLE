import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { AppShellFrame, type ShellToastState } from "./AppShellFrame"

afterEach(cleanup)

it("keeps storage recovery inside the scrolling frame and alive through save results", () => {
  const mounted = vi.fn(), removed = vi.fn()
  function Recovery() {
    React.useEffect(() => { mounted(); return removed }, [])
    return <div role="alert"><button>합성 저장 재시도</button></div>
  }
  const props = { scrollRegionRef: React.createRef<HTMLElement>(), tab: "home" as const,
    onDismissToast: vi.fn(), onOpenTrends: vi.fn(), onTab: vi.fn(), systemStatus: <Recovery /> }
  function frame(savedToast: ShellToastState | null) {
    return <AppShellFrame {...props} savedToast={savedToast}><h1>합성 본문</h1></AppShellFrame>
  }
  const view = render(frame(null))
  expect(screen.getByRole("alert").closest(".app-scroll-region")).toBe(screen.getByRole("main"))
  view.rerender(frame({ count: 1, phase: "enter", receipt: { kind: "generic", savedDate: "2026-10-14" } }))
  expect(screen.getByRole("button", { name: "합성 저장 재시도" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "합성 본문" })).not.toBeInTheDocument()
  view.rerender(frame(null))
  expect(screen.getByRole("heading", { name: "합성 본문" })).toBeVisible()
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(removed).not.toHaveBeenCalled()
})
