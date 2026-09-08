import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ hydrate: vi.fn(), recovery: vi.fn().mockResolvedValue([]) }))
vi.mock("../domain/account/account-journal-projection", () => ({ accountJournalProjectionStatus: () => "REJECTED" }))
vi.mock("../domain/account/account-journal-record-service", () => ({ hydrateAccountJournalRecords: mocks.hydrate,
  listAccountJournalRecoveryRecords: mocks.recovery }))
vi.mock("./AccountJournalConflictResolver", () => ({ AccountJournalConflictResolver: () => null }))
import { AccountJournalStorageStatus } from "./AccountJournalStorageStatus"
afterEach(cleanup)

it("explains rejection, encrypted retention and unconfirmed metrics without offering automatic resubmission", async () => {
  render(<AccountJournalStorageStatus />)
  expect(await screen.findByText(/서버가 기록 저장을 명시적으로 거절했어요/)).toHaveTextContent("암호화된 기기 보관본")
  expect(screen.getByText(/저장 완료가 아니며/)).toHaveTextContent("미확인 입력은 통계에 반영하지 않았어요")
  expect(screen.getByText(/자동 재전송은 중지/)).toHaveTextContent("새 요청으로 다시 제출하지 않아요")
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(mocks.hydrate).not.toHaveBeenCalled()
})
