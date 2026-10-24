import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OracleSectionNavigation, type OracleHubSection } from "./OracleSectionNavigation"
import { renderWithDomainNavigation as render } from "../test/DomainNavigationTestFrame"

afterEach(cleanup)

it("keeps area destinations and 22px icons stable without a duplicate upper menu or navigation checks", () => {
  const onSelect = vi.fn()
  const view = render(<OracleSectionNavigation current="training" onSelect={onSelect} />)
  const nav = screen.getByRole("navigation", { name: "오라클 메뉴" })
  const buttons = within(nav).getAllByRole("button").slice(1)
  expect(buttons.map(button => button.textContent)).toEqual(["분석", "취향", "읽을거리"])
  const icons = buttons.map(button => button.querySelector("svg")!.innerHTML)
  expect(screen.queryByRole("navigation", { name: "오라클 항목" })).toBeNull()
  expect(screen.queryByRole("button", { name: "뒤로" })).toBeNull()
  expect(screen.getByRole("button", { name: "기록하기" })).toBeVisible()
  for (const [index, section] of (["training", "profile", "library"] as OracleHubSection[]).entries()) {
    view.rerender(<OracleSectionNavigation current={section} onSelect={onSelect} />)
    expect(within(nav).getAllByRole("button").slice(1)).toEqual(buttons)
    expect(buttons.map(button => button.querySelector("svg")!.innerHTML)).toEqual(icons)
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(buttons[index]).toHaveAttribute("aria-current", "page")
    for (const button of buttons) {
      expect(button.querySelector(".lucide-check")).toBeNull()
      expect(button.querySelector("svg")).toHaveAttribute("width", "22")
    }
    fireEvent.click(buttons[index]!)
    expect(onSelect).not.toHaveBeenCalled()
  }
  fireEvent.click(buttons[0]!)
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("training")
})
