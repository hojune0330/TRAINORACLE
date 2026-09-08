import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { AccountPlanCollectionService } from "../../domain/account/account-plan-collection-service"
import { AccountPlanLegacyRecovery } from "./AccountPlanLegacyRecovery"

vi.mock("./AccountPlanHistoricalView", () => ({ AccountPlanHistoricalView: () => <p>저장 대기 원본</p> }))
afterEach(cleanup)
function fixture(result = "PENDING") {
  const view = { status: "PENDING", legacyPendingCount: 1, legacyPendingPlans: [], totalPlans: 2 } as unknown as ReturnType<AccountPlanCollectionService["snapshot"]>
  const recover = vi.fn(async () => result)
  const service = { snapshot: () => view, recoverLegacyPending: recover } as unknown as AccountPlanCollectionService
  return { view, service, recover }
}

it("offers history-only preservation and never invents a successful fresh selection review", async () => {
  const f = fixture(); render(<AccountPlanLegacyRecovery {...f} />)
  fireEvent.click(screen.getByRole("button", { name: "계획 원본으로 보관" }))
  await waitFor(() => expect(f.recover).toHaveBeenCalledOnce())
  const call = f.recover.mock.calls[0] as unknown as [() => boolean, string]
  expect(call[0]()).toBe(false); expect(call[1]).toBe("HISTORY")
  await screen.findByText(/아직 계정 저장이 끝나지 않았어요/u)
})

it("says explicitly that accepting the server is not an online copy of the pending original", async () => {
  const f = fixture("ACCOUNT"); render(<AccountPlanLegacyRecovery {...f} />)
  expect(screen.getByText(/대기본이 온라인에 복사되는 것은 아니에요/u)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "기기 대기본 남기고 계정 계획 보기" }))
  await screen.findByText(/기존 자료를 보존하고 계정 상태를 다시 확인/u)
  expect((f.recover.mock.calls[0] as unknown as [unknown, string])[1]).toBe("SERVER")
})

it("keeps history conflicts visible and never calls them saved", async () => {
  const f = fixture("HISTORY_CONFLICT"); render(<AccountPlanLegacyRecovery {...f} />)
  fireEvent.click(screen.getByRole("button", { name: "계획 원본으로 보관" }))
  await screen.findByText(/어느 쪽도 덮어쓰지 않았어요/u)
  expect(screen.queryByText(/계정 상태를 다시 확인했어요/u)).toBeNull()
})
