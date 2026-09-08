import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
const mocks = vi.hoisted(() => ({ enabled: true, owner: "owner", save: vi.fn(), load: vi.fn(), restore: vi.fn(), activeRestore: vi.fn() }))
vi.mock("../../domain/multi-plan-active-restore-v3", () => ({ restoreMultiPlanAsCurrentV3: mocks.activeRestore }))
vi.mock("../../domain/account/plan-cloud-backup", () => ({ planCloudBackupEnabled: () => mocks.enabled }))
vi.mock("../../domain/account/local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner }))
vi.mock("../../domain/account/multi-plan-cloud-backup-v3", () => ({
  backupMultiPlanSnapshotV3: mocks.save, loadLatestMultiPlanSnapshotV3: mocks.load, restoreMultiPlanServerHistoryV3: mocks.restore,
}))
import { MultiPlanCloudControlsV3 } from "./MultiPlanCloudControlsV3"
beforeEach(() => { vi.resetAllMocks(); mocks.enabled = true; mocks.owner = "owner" })
afterEach(cleanup)
const props = { fingerprint: "TEST", readEvidence: () => [] }
it("does not show server actions when account backup is unavailable", () => {
  mocks.enabled = false
  render(<MultiPlanCloudControlsV3 {...props} />)
  expect(screen.queryByRole("button")).toBeNull()
})
it("requires confirmation after reading and labels restoration as history only", async () => {
  mocks.load.mockResolvedValue({ kind: "read_only", ownerId: "owner", state: { selection: { intake: { startDate: "2026-09-08" } }, progress: [] } })
  mocks.restore.mockResolvedValue({ kind: "restored_history" })
  render(<MultiPlanCloudControlsV3 {...props} />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "서버의 최근 원본 확인" })))
  expect(mocks.restore).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "원본 보관함에 추가" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "원본 보관함에 추가" })))
  expect(mocks.restore).toHaveBeenCalledOnce()
  expect(screen.getByRole("status")).toHaveTextContent("현재 일정은 그대로예요")
})
it("ignores a late success after the local account changes and prevents duplicate sends", async () => {
  let resolve!: (value: unknown) => void
  mocks.save.mockReturnValue(new Promise(done => { resolve = done }))
  render(<MultiPlanCloudControlsV3 {...props} />)
  const button = screen.getByRole("button", { name: "내 계정에 계획 보관" })
  fireEvent.click(button); fireEvent.click(button)
  expect(mocks.save).toHaveBeenCalledOnce()
  mocks.owner = "different"
  await act(async () => resolve({ kind: "saved" }))
  expect(screen.queryByRole("status")).toBeNull()
})
it("separates active restore confirmation from history restore and requires a current body check", async () => {
  mocks.load.mockResolvedValue({ kind: "read_only", ownerId: "owner", state: { selection: { intake: { startDate: "2026-09-08" } }, progress: [] } })
  mocks.activeRestore.mockResolvedValue({ kind: "restored_current" })
  const onCurrentRestored = vi.fn()
  render(<MultiPlanCloudControlsV3 {...props} fingerprint={null} onCurrentRestored={onCurrentRestored}
    readRestoreReview={() => ({ preparations: [], rpeBindings: [], policies: [], retained: [] })} />)
  expect(screen.queryByRole("button", { name: "내 계정에 계획 보관" })).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "서버의 최근 원본 확인" })))
  const restore = screen.getByRole("button", { name: "현재 일정으로 불러오기" })
  fireEvent.click(screen.getByRole("checkbox", { name: "현재 일정은 유지하고 이 원본을 보관함에 추가해요." }))
  expect(restore).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: "원래 날짜와 진행 기록을 유지해 현재 일정으로 불러와요." }))
  expect(restore).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "알고 있는 통증이나 이상이 없어요" }))
  await act(async () => fireEvent.click(restore))
  expect(mocks.restore).not.toHaveBeenCalled()
  expect(mocks.activeRestore).toHaveBeenCalledOnce()
  expect(onCurrentRestored).toHaveBeenCalledOnce()
})
