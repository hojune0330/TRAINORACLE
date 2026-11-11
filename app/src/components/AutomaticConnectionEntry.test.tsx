import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { AutomaticConnectionEntry } from "./AutomaticConnectionEntry"

afterEach(cleanup)

it("offers one keyboard-accessible destination and only invokes the supplied navigation", async () => {
  const onOpen = vi.fn(), user = userEvent.setup()
  render(<AutomaticConnectionEntry onOpen={onOpen} />)
  const entry = screen.getByRole("button", { name: "운동 가져오기" })
  expect(screen.getAllByRole("button")).toHaveLength(1)
  expect(entry).toHaveAttribute("data-category", "record")
  expect(entry).toHaveTextContent("추천")
  expect(entry).toHaveAccessibleDescription("워치 자동 연결 · 받은 운동 확인 · 파일 가져오기")
  expect(onOpen).not.toHaveBeenCalled()
  await user.tab()
  expect(entry).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(onOpen).toHaveBeenCalledOnce()
  expect(entry).toHaveFocus()
})
