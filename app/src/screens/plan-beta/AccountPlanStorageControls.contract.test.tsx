import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { AccountPlanStorageControls } from "./AccountPlanStorageControls"

afterEach(cleanup)
it("distinguishes pending, failed and evidence-required state without an activation control", () => {
  const retry = vi.fn()
  const ui = render(<AccountPlanStorageControls status="PENDING" onRetry={retry} />)
  expect(screen.getByRole("status")).toHaveTextContent("연결 대기")
  fireEvent.click(screen.getByRole("button", { name: "계획 저장 다시 확인" }))
  expect(retry).toHaveBeenCalledOnce()
  ui.rerender(<AccountPlanStorageControls status="FAILED" evidenceRequired onRetry={retry} />)
  expect(screen.getByRole("status")).toHaveTextContent("실패")
  expect(screen.getByRole("alert")).toHaveTextContent("현재 훈련을 시작하는 데 필요한 조건과 근거는 아직 확인되지 않아 원본만 표시")
  expect(screen.queryByRole("button", { name: /활성|현재로/ })).toBeNull()
})
it("shows rejected writes as preserved but not account-saved, without automatic resubmission", () => {
  render(<AccountPlanStorageControls status="REJECTED" onRetry={vi.fn()} />)
  expect(screen.getByRole("status")).toHaveTextContent("계정 저장 거절됨")
  expect(screen.getByRole("alert")).toHaveTextContent("기기 원본과 저장 요청은 삭제하지 않았으며")
  expect(screen.queryByRole("button")).toBeNull()
})
it("never offers silent overwrite on a conflict", () => {
  render(<AccountPlanStorageControls status="CONFLICT" onRetry={vi.fn()} />)
  expect(screen.getByRole("status")).toHaveTextContent("충돌 확인 필요")
  expect(screen.queryByRole("button")).toBeNull()
})
