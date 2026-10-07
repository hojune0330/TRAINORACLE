import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage, restorePlanBetaStateIfMissing, savePlanBetaState } from "../domain/plan-beta-store"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const cloud = vi.hoisted(() => ({ load: vi.fn(), backup: vi.fn(async () => ({ kind: "saved" })) }))
vi.mock("../domain/account/plan-cloud-backup", () => ({
  PLAN_CLOUD_ARCHIVE_STORAGE_KEY: "trainoracle.plan-cloud-archive.v1",
  planCloudBackupEnabled: () => true, loadLatestPlanFromServer: cloud.load,
  backupActivePlanToServer: cloud.backup, archivePlanOnServer: vi.fn(async () => {}),
}))
let locksDescriptor: PropertyDescriptor | undefined
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const newerPlan = () => ({ ...stateFixture(), progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const }] })
const storageChanged = () => act(() => {
  window.dispatchEvent(new StorageEvent("storage", { key: activePlanBetaStorageKey(), storageArea: localStorage }))
})
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount("synthetic-a")
  cloud.load.mockReset(); cloud.backup.mockClear()
  locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); setActiveLocalAccount(null)
  if (locksDescriptor) Object.defineProperty(navigator, "locks", locksDescriptor)
  else Reflect.deleteProperty(navigator, "locks")
})

it("restores a valid cloud plan into a still-empty local slot and shows the recovered plan", async () => {
  cloud.load.mockResolvedValue({ kind: "loaded", state: stateFixture() })
  render(<PlanBeta />)
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: stateFixture() })
  expect(screen.queryByText("계정에 저장된 훈련 계획을 확인하고 있어요")).not.toBeInTheDocument()
})

it("preserves and displays a new local plan saved in another tab while the older cloud restore response was pending", async () => {
  const response = deferred<unknown>()
  cloud.load.mockReturnValue(response.promise)
  render(<PlanBeta />)
  expect(screen.getByRole("status")).toHaveTextContent("계정에 저장된 훈련 계획을 확인하고 있어요")
  const newer = newerPlan()
  expect(savePlanBetaState(newer)).toEqual({ ok: true })
  storageChanged()
  await act(async () => { response.resolve({ kind: "loaded", state: stateFixture() }); await response.promise })
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: newer })
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "날짜별 카드 보기" }))
  await user.click(screen.getAllByText(/훈련 방법과 기록/u)[0]!)
  expect(screen.getByText("완료", { selector: "em" })).toBeVisible()
})

it.each(["invalid", "unreadable"] as const)("preserves %s local state that appears during a cloud request", async mode => {
  const response = deferred<unknown>()
  cloud.load.mockReturnValue(response.promise)
  render(<PlanBeta />)
  const key = activePlanBetaStorageKey(), originalGet = Storage.prototype.getItem
  localStorage.setItem(key, "{synthetic-original")
  if (mode === "unreadable") vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, queried: string) {
    if (queried === key) throw Error("Synthetic storage read failure")
    return originalGet.call(this, queried)
  })
  const write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem")
  await act(async () => { response.resolve({ kind: "loaded", state: stateFixture() }); await response.promise })
  expect(originalGet.call(localStorage, key)).toBe("{synthetic-original")
  expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  expect(screen.getByRole("heading", { name: "저장된 계획을 확인하지 못했어요" })).toBeVisible()
})

it("does not revive a cloud request after leaving and returning to its account", async () => {
  const response = deferred<unknown>()
  cloud.load.mockReturnValueOnce(response.promise).mockResolvedValue({ kind: "empty" })
  render(<PlanBeta />)
  act(() => { setActiveLocalAccount("synthetic-b"); setActiveLocalAccount("synthetic-a") })
  const write = vi.spyOn(Storage.prototype, "setItem")
  await act(async () => { response.resolve({ kind: "loaded", state: stateFixture() }); await response.promise })
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
})

it("ends the loading view when a cloud request rejects", async () => {
  cloud.load.mockRejectedValue(Error("Synthetic offline failure"))
  render(<PlanBeta />)
  expect(await screen.findByRole("button", { name: "5km" })).toBeVisible()
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
})

it.each(["plan", "account-aba"] as const)("rechecks the %s after waiting for the restore mutation lock", async change => {
  let release!: () => Promise<void>
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => new Promise(resolve => {
      release = async () => { resolve(await callback({})) }
    }),
  } })
  const result = restorePlanBetaStateIfMissing(stateFixture(), () => true)
  if (change === "plan") expect(savePlanBetaState(newerPlan())).toEqual({ ok: true })
  else { setActiveLocalAccount("synthetic-b"); setActiveLocalAccount("synthetic-a") }
  const before = JSON.stringify(localStorage), write = vi.spyOn(Storage.prototype, "setItem")
  await release()
  await expect(result).resolves.toEqual({ kind: "preserved" })
  expect(JSON.stringify(localStorage)).toBe(before)
  expect(write).not.toHaveBeenCalled()
})

it.each(["unavailable", "busy"] as const)("leaves the slot empty when the restore mutation lock is %s", async mode => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: mode === "unavailable" ? undefined : {
    request: async (_name: string, _options: unknown, callback: (lock: null) => unknown) => callback(null),
  } })
  expect(await restorePlanBetaStateIfMissing(stateFixture(), () => true)).toEqual({ kind: "failed", rollbackComplete: true })
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
})

it.each(["quota", "write-then-throw", "other-writer"] as const)("preserves the correct bytes after restore %s failure", async mode => {
  const originalSet = Storage.prototype.setItem, key = activePlanBetaStorageKey(), newer = JSON.stringify(newerPlan())
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, queried: string, value: string) {
    if (queried !== key) return originalSet.call(this, queried, value)
    if (mode === "write-then-throw") originalSet.call(this, queried, value)
    if (mode === "other-writer") originalSet.call(this, queried, newer)
    throw Error("Synthetic storage failure")
  })
  expect(await restorePlanBetaStateIfMissing(stateFixture(), () => true))
    .toEqual({ kind: "failed", rollbackComplete: mode !== "other-writer" })
  expect(localStorage.getItem(key)).toBe(mode === "other-writer" ? newer : null)
})
