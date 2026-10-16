import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OracleSectionNavigation, type OracleHubSection } from "./OracleSectionNavigation"

afterEach(cleanup)

it("keeps all destinations and icon/check slots in place while only the current section changes", () => {
  const onSelect = vi.fn()
  const view = render(<OracleSectionNavigation current="training" onSelect={onSelect} />)
  const nav = screen.getByRole("navigation", { name: "오라클 항목" })
  const buttons = within(nav).getAllByRole("button")
  expect(buttons.map(button => button.textContent)).toEqual(["내 훈련", "러닝 취향", "읽을거리"])
  const icons = buttons.map(button => button.querySelector(".category-icon")!.innerHTML)
  for (const [index, section] of (["training", "profile", "library"] as OracleHubSection[]).entries()) {
    view.rerender(<OracleSectionNavigation current={section} onSelect={onSelect} />)
    expect(within(nav).getAllByRole("button")).toEqual(buttons)
    expect(buttons.map(button => button.querySelector(".category-icon")!.innerHTML)).toEqual(icons)
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(buttons[index]).toHaveAttribute("aria-current", "page")
    for (const button of buttons) expect(button.querySelector(".oracle-section-nav__check")).not.toBeNull()
    fireEvent.click(buttons[index]!)
    expect(onSelect).not.toHaveBeenCalled()
  }
  fireEvent.click(buttons[0]!)
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("training")
})
