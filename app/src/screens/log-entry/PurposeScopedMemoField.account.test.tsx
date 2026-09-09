import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { MemoPurpose } from "../../domain/journal-schema"

const flag = vi.hoisted(() => ({ enabled: true }))
vi.mock("../../domain/account/account-journal-record-service", () => ({ accountJournalRecordsEnabled: () => flag.enabled }))
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"

function Fixture({ purpose, text = "" }: { purpose?: MemoPurpose; text?: string }) {
  const controller = usePurposeScopedMemo(text, purpose)
  return <PurposeScopedMemoField controller={controller} fieldId="synthetic-note" label="시험 메모" />
}
beforeEach(() => { flag.enabled = true })
afterEach(cleanup)

it.each([undefined, "PRIVATE_SELF_ONLY", "ANALYZABLE_TRAINING_NOTE"] as const)(
  "describes account encryption and private exclusions for purpose %s without claiming device-only storage", purpose => {
    const { container } = render(<Fixture purpose={purpose} />)
    expect(container).toHaveTextContent("원문을 암호화해 계정에 보관해요")
    expect(container).toHaveTextContent("서비스가 복호화할 수 있으며 종단간 암호화(E2EE)는 아니에요")
    expect(container).toHaveTextContent("비밀 메모는 공유·분석에 사용하지 않아요")
    expect(container).not.toHaveTextContent(/원문은 (이 )?기기에만 남/)
    expect(container).not.toHaveTextContent("계정에 저장됐어요")
  },
)

it.each([
  [undefined, "글을 적는다면 용도를 먼저 선택해 주세요. 원문은 이 기기에만 남아요."],
  ["PRIVATE_SELF_ONLY", "원문은 이 기기에만 남고 분석하지 않아요."],
  ["ANALYZABLE_TRAINING_NOTE", "저장 전에 이 기기에서만 잠시 검토해요. 원문은 기기에만 남고 훈련 계획의 근거로 쓰지 않아요."],
] as const)("preserves the exact flag-off explanation for %s", (purpose, expected) => {
  flag.enabled = false
  const { container } = render(<Fixture purpose={purpose} />)
  expect(screen.getByText(expected)).toBeVisible()
  expect(container).not.toHaveTextContent("계정에 보관")
})

it.each([true, false])("retains D9 review attention with storage-mode-appropriate copy (account %s)", enabled => {
  flag.enabled = enabled
  render(<Fixture purpose="ANALYZABLE_TRAINING_NOTE" text="무릎이 아파" />)
  fireEvent.blur(screen.getByRole("textbox"))
  const status = screen.getByRole("status")
  expect(status).toHaveTextContent("자동 확인을 완료하지 못했어요")
  expect(status).toHaveTextContent(enabled ? "계정 저장 여부는 저장 결과에서 확인해 주세요." : "저장은 이 기기에만 됩니다.")
  if (enabled) expect(status).not.toHaveTextContent("저장은 이 기기에만 됩니다.")
})

it("updates copy on a storage-mode rerender without replacing typed text or its purpose", () => {
  const view = render(<Fixture />)
  fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "synthetic-private-fixture" } })
  flag.enabled = false
  view.rerender(<Fixture />)
  expect(screen.getByText("원문은 이 기기에만 남고 분석하지 않아요.")).toBeVisible()
  expect(screen.getByRole("textbox")).toHaveValue("synthetic-private-fixture")
  expect(screen.getByRole("radio", { name: "나만의 메모" })).toBeChecked()
})
