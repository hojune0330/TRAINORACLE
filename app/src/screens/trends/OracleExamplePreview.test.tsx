import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OracleExamplePreview } from "./OracleExamplePreview"
import { getOracleTopic } from "../../domain/oracle-exploration"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(["mix", "compare", "focus"] as const)("renders authored %s examples without writing storage", topicId => {
  const write = vi.spyOn(Storage.prototype, "setItem")
  const open = vi.fn()
  const { container } = render(<OracleExamplePreview topicId={topicId} onOpen={open} />)
  expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("내 기록 분석이 아니에요"))
  const example = getOracleTopic(topicId).example
  const max = Math.max(...example.rows.map(row => row.value))
  const widths = Array.from(container.querySelectorAll<HTMLElement>(".oracle-example-preview__track > span"), item => item.style.width)
  expect(widths).toEqual(example.rows.map(row => `${row.value / max * 100}%`))
  fireEvent.click(screen.getByText("표로 보기"))
  expect(screen.getByRole("table")).toHaveAccessibleName(expect.stringContaining("예시"))
  fireEvent.click(screen.getByRole("button", { name: "예시 결과 보기" }))
  expect(open).toHaveBeenCalledOnce()
  expect(write).not.toHaveBeenCalled()
})

it("keeps a clearly labelled example reachable beside actual facts", () => {
  const open = vi.fn()
  render(<OracleExamplePreview compact onOpen={open} />)
  expect(screen.queryByRole("img")).toBeNull()
  const button = screen.getByRole("button", { name: "예시 결과 보기" })
  expect(button).toHaveAccessibleDescription("예시 · 내 기록 분석이 아니에요")
  fireEvent.click(button)
  expect(open).toHaveBeenCalledOnce()
})
