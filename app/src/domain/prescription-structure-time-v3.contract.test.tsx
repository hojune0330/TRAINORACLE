import React from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { PrescriptionStructureV3 } from "../screens/plan-beta/PrescriptionStructureV3"
import { METHOD_ADOPTION_PROTOCOLS } from "../../../reports/research/method-adoption-protocols.mjs"
import { representPendingWholeSessionV3 } from "../../../reports/research/method-proposal-sequence-v3"

afterEach(cleanup)
function sequence(id: string) {
  const result = representPendingWholeSessionV3(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)!)
  if (result.kind !== "represented") throw Error("Missing sequence")
  return result.sequence
}

it("compares the real original range without treating elapsed time as intensity or changing the prescription", () => {
  const original = { minimum: 25, maximum: 40 }
  const source = sequence("P-LT-C")
  const before = JSON.stringify(source)
  const view = render(<PrescriptionStructureV3 sequence={source} originalDurationMinutes={original} />)
  expect(screen.getByLabelText("변경 전 시간과 비교")).toHaveTextContent("9분 20초 길어요")
  expect(screen.getByLabelText("변경 전 시간과 비교")).toHaveTextContent("강도나 효과가 같다는 뜻은 아니에요")
  expect(JSON.stringify(source)).toBe(before)
  view.rerender(<PrescriptionStructureV3 sequence={sequence("P-GLY-S")} originalDurationMinutes={original} />)
  expect(screen.getByLabelText("변경 전 시간과 비교")).toHaveTextContent("비교할 수 없어요")
  expect(screen.getByLabelText("변경 전 시간과 비교")).not.toHaveTextContent("9분 20초")
  view.rerender(<PrescriptionStructureV3 sequence={source} />)
  expect(screen.queryByLabelText("변경 전 시간과 비교")).not.toBeInTheDocument()
})

it("shows whole elapsed time including support and recovery before the instructions", () => {
  render(<PrescriptionStructureV3 sequence={sequence("P-LT-C")} />)
  const total = screen.getByLabelText("계획된 전체 시간")
  expect(total).toHaveTextContent("49분 20초")
  expect(total).toHaveTextContent("준비·회복·정리 포함")
  expect(within(screen.getByRole("region", { name: "정리" })).getByText(/정리 구간/)).toBeVisible()
  expect(screen.queryByText(/PROGRESSIVE_NOT_ALL_OUT/)).not.toBeInTheDocument()
  expect(screen.getByText(/15분 · RPE 2-3/)).toBeVisible()
  expect(total.compareDocumentPosition(screen.getByRole("region", { name: "준비" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it("never treats a distance prescription as zero time or the sum of its known recovery alone", () => {
  render(<PrescriptionStructureV3 sequence={sequence("P-GLY-S")} />)
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("전체 시간 미산출")
  expect(screen.getByLabelText("계획된 전체 시간")).not.toHaveTextContent("0초")
})

it("refreshes the total when the selected method changes without retaining old numbers", () => {
  const view = render(<PrescriptionStructureV3 sequence={sequence("P-LT-C")} />)
  view.rerender(<PrescriptionStructureV3 sequence={sequence("P-LT-B")} />)
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("50분 20초")
  expect(screen.getByLabelText("계획된 전체 시간")).not.toHaveTextContent("49분")
  view.rerender(<PrescriptionStructureV3 sequence={sequence("P-GLY-S")} />)
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("미산출")
})
