import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PopCard, usePopover } from "./Popover"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("prefers space above an input help trigger and restores focus on Escape", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("popover-positioner")
      ? new DOMRect(100, 306, 232, 120) : new DOMRect(100, 270, 44, 30)
  })
  function Fixture() {
    const { open, toggle, wrapRef } = usePopover()
    return <span ref={wrapRef}><button onClick={toggle}>강도 설명</button>
      <PopCard open={open} accentBorder={{ border: "var(--line)", bar: "var(--ink)" }}>짧은 설명</PopCard>
    </span>
  }
  const { container } = render(<Fixture />)
  fireEvent.click(screen.getByRole("button", { name: "강도 설명" }))
  expect(container.querySelector(".popover-positioner")).toHaveAttribute("data-side", "top")
  fireEvent.keyDown(document, { key: "Escape" })
  expect(screen.queryByRole("note")).toBeNull()
  expect(screen.getByRole("button", { name: "강도 설명" })).toHaveFocus()
})
