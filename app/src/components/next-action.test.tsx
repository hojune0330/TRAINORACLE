import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { nextActionFeedback } from "./next-action"

afterEach(cleanup)
it("shows press feedback before activation and clears it on cancellation or leaving", () => {
  const action = vi.fn()
  render(<button {...nextActionFeedback} className="next-action" onClick={action}>다음</button>)
  const button = screen.getByRole("button", { name: "다음" })
  fireEvent.pointerDown(button, { button: 0 })
  expect(button).toHaveAttribute("data-pressed", "true")
  expect(action).not.toHaveBeenCalled()
  fireEvent.pointerCancel(window)
  expect(button).not.toHaveAttribute("data-pressed")
  expect(action).not.toHaveBeenCalled()
  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.pointerLeave(button)
  fireEvent.pointerUp(window)
  expect(button).not.toHaveAttribute("data-pressed")
  expect(action).not.toHaveBeenCalled()
  fireEvent.click(button)
  expect(action).toHaveBeenCalledTimes(1)
})
it("keeps disabled actions inactive", () => {
  const action = vi.fn()
  render(<button {...nextActionFeedback} className="next-action" disabled onClick={action}>다음</button>)
  const button = screen.getByRole("button", { name: "다음" })
  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.click(button)
  expect(button).not.toHaveAttribute("data-pressed")
  expect(action).not.toHaveBeenCalled()
})
