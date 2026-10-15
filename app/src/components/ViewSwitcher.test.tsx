import { useState } from "react"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { ViewSwitcher } from "./ViewSwitcher"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const options = [{ value: "calendar", label: "달력" }, { value: "day", label: "하루씩" }] as const

it("keeps a controlled view and distinguishes radios from navigation actions", async () => {
  const change = vi.fn()
  const view = render(<ViewSwitcher category="training" label="훈련 보기" value="calendar" options={options} onValueChange={change} />)
  const group = screen.getByRole("radiogroup", { name: "훈련 보기" })
  const day = within(group).getByRole("radio", { name: "하루씩" })
  await userEvent.click(day)
  expect(change).toHaveBeenCalledExactlyOnceWith("day")
  expect(day).toHaveAttribute("aria-checked", "false")
  view.rerender(<ViewSwitcher category="training" label="훈련 보기" value="day" options={options} onValueChange={change} />)
  expect(day).toHaveAttribute("aria-checked", "true")
  expect(within(group).queryByRole("tab")).toBeNull()
})

it("supports arrow keys without crossing into another view group or submitting a form", async () => {
  // jsdom has no layout observer; real-browser size/overflow checks are separate.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const submit = vi.fn()
  function Harness() {
    const [value, change] = useState<"calendar" | "day">("calendar")
    return <form onSubmit={submit}>
      <ViewSwitcher category="training" label="훈련 보기" value={value} options={options} onValueChange={change} />
      <ViewSwitcher category="journal" label="일지 보기" value="calendar" options={options} onValueChange={vi.fn()} />
    </form>
  }
  render(<Harness />)
  const user = userEvent.setup()
  const groups = screen.getAllByRole("radiogroup")
  const first = within(groups[0]!).getByRole("radio", { name: "달력" })
  await user.click(first)
  // Radix moves focus on the next task; keep keydown active until that focus runs.
  await user.keyboard("{ArrowRight>}")
  await waitFor(() => expect(within(groups[0]!).getByRole("radio", { name: "하루씩" })).toHaveAttribute("aria-checked", "true"))
  await user.keyboard("{/ArrowRight}")
  expect(within(groups[1]!).getByRole("radio", { name: "달력" })).toHaveAttribute("aria-checked", "true")
  const ids = screen.getAllByRole("radio").map(node => node.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(submit).not.toHaveBeenCalled()
})
