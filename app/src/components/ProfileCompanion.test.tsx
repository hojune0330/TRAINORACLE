import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { ProfileCompanion } from "./ProfileCompanion"

afterEach(() => {
  cleanup()
  localStorage.removeItem("trainoracle.calendar-reduced-motion.v1")
  window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  vi.restoreAllMocks()
})

it("offers an optional keyboard tip with a reactive pose without storing an answer", async () => {
  const user = userEvent.setup()
  const writes = vi.spyOn(Storage.prototype, "setItem")
  const { container } = render(<ProfileCompanion mode="intro" />)
  const button = screen.getByRole("button", { name: "마리의 답변 팁", expanded: false })
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("mari-profile-hello-v4.webp"))
  expect(screen.getByText("정답은 없어요. 평소 내 모습에 가까운 답을 골라요.")).not.toBeVisible()
  button.focus()
  await user.keyboard("{Enter}")
  expect(button).toHaveAttribute("aria-expanded", "true")
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("mari-profile-wave-v4.webp"))
  expect(screen.getByText("정답은 없어요. 평소 내 모습에 가까운 답을 골라요.")).toBeVisible()
  await user.keyboard("{Escape}")
  expect(button).toHaveAttribute("aria-expanded", "false")
  expect(button).toHaveFocus()
  expect(writes).not.toHaveBeenCalled()
})

it("keeps the named action when artwork fails and resets expanded state for the result", () => {
  const { container, rerender } = render(<ProfileCompanion mode="intro" />)
  fireEvent.error(container.querySelector("img")!)
  expect(container.querySelector("img")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "마리의 답변 팁" }))
  expect(screen.getByText("정답은 없어요. 평소 내 모습에 가까운 답을 골라요.")).toBeVisible()
  rerender(<ProfileCompanion mode="result" />)
  const result = screen.getByRole("button", { name: "마리의 결과 안내", expanded: false })
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("mari-profile-explain-v4.webp"))
  fireEvent.click(result)
  expect(screen.getByText("선택한 답으로 정리한 취향이에요. 실력이나 건강을 평가한 결과는 아니에요.")).toBeVisible()
})

it("honors live app motion changes without disabling the helper", () => {
  const { container } = render(<ProfileCompanion mode="intro" />)
  expect(container.firstChild).toHaveAttribute("data-reduced-motion", "false")
  act(() => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  })
  expect(container.firstChild).toHaveAttribute("data-reduced-motion", "true")
  fireEvent.click(screen.getByRole("button", { name: "마리의 답변 팁" }))
  expect(screen.getByRole("button", { name: "마리의 답변 팁", expanded: true })).toBeEnabled()
})
