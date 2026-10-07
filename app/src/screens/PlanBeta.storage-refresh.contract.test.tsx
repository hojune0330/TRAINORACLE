import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { activePlanBetaStorageKey, readPlanBetaStateFromStorage, savePlanBetaState } from "../domain/plan-beta-store"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"
import * as legacyArchive from "../domain/legacy-plan-archive"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const storageChanged = (key: string | null = activePlanBetaStorageKey()) => act(() => {
  window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }))
})
const showProgress = async () => {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "날짜별 카드 보기" }))
  await user.click(screen.getAllByText(/훈련 방법과 기록/u)[0]!)
}
function storeLegacyOriginal() {
  const current = stateFixture()
  if (current.version !== 3) throw Error("Expected V3 fixture")
  const { eventDistanceM: _distance, selectedDetailedTemplateRef: _ref, ...intake } = current.intake
  const { pairId: _pair, selectedDetailedTemplateRef: _activeRef, ...activePlan } = current.activePlan
  const raw = JSON.stringify({ ...current, version: 1, intake, activePlan }, null, 2)
  localStorage.setItem(activePlanBetaStorageKey(), raw)
  return raw
}

it("refreshes active progress changed in another tab without requiring remount", async () => {
  const original = stateFixture()
  expect(savePlanBetaState(original)).toEqual({ ok: true })
  render(<PlanBeta />)
  await showProgress()
  expect(screen.getByText("예정", { selector: "em" })).toBeVisible()
  const updated = { ...original, progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const }] }
  expect(savePlanBetaState(updated)).toEqual({ ok: true })
  storageChanged()
  expect(screen.getByText("완료", { selector: "em" })).toBeVisible()
  expect(screen.queryByText("예정", { selector: "em" })).not.toBeInTheDocument()
})

it("stops displaying an active plan removed in another tab", async () => {
  expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
  render(<PlanBeta />)
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  localStorage.removeItem(activePlanBetaStorageKey())
  storageChanged()
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
  expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
})

it.each(["changed", "deleted", "cleared"])("preserves a partially answered draft when another tab's plan is %s", async mode => {
  render(<PlanBeta />)
  await enterPlanWithoutRecord("5km")
  const question = screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u })
  expect(question).toBeVisible()
  if (mode === "changed") expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
  else localStorage.removeItem(activePlanBetaStorageKey())
  storageChanged(mode === "cleared" ? null : activePlanBetaStorageKey())
  expect(question).toBeVisible()
  expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).not.toBeInTheDocument()
})

it.each(["unreadable", "invalid"])("protects a draft during a %s plan read and restores it after retry", async mode => {
  render(<PlanBeta />)
  await enterPlanWithoutRecord("5km")
  const question = screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u })
  const originalGet = Storage.prototype.getItem
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
    if (key === activePlanBetaStorageKey()) {
      if (mode === "unreadable") throw new Error("Synthetic read failure")
      return "{"
    }
    return originalGet.call(this, key)
  })
  storageChanged()
  expect(screen.getByRole("heading", { name: "저장된 계획을 확인하지 못했어요" })).toBeVisible()
  expect(question).not.toBeVisible()
  read.mockRestore()
  await userEvent.setup().click(screen.getByRole("button", { name: "다시 확인" }))
  expect(question).toBeVisible()
  expect(screen.queryByRole("heading", { name: "저장된 계획을 확인하지 못했어요" })).not.toBeInTheDocument()
})

it("retains raw record fields across a storage outage without resubmitting them", async () => {
  const user = userEvent.setup()
  render(<PlanBeta />)
  await user.click(screen.getByRole("button", { name: "5km" }))
  await user.click(screen.getByRole("button", { name: "목표만 있어요" }))
  await user.type(screen.getByRole("textbox", { name: "분" }), "23")
  await user.type(screen.getByRole("textbox", { name: "초" }), "41.2")
  const minutes = screen.getByRole("textbox", { name: "분" })
  localStorage.setItem(activePlanBetaStorageKey(), "{")
  storageChanged()
  expect(minutes).not.toBeVisible()
  localStorage.removeItem(activePlanBetaStorageKey())
  await user.click(screen.getByRole("button", { name: "다시 확인" }))
  expect(minutes).toBeVisible()
  expect(minutes).toHaveValue("23")
  expect(screen.getByRole("textbox", { name: "초" })).toHaveValue("41.2")
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
})

it("preserves an unfinished next-frame draft when its predecessor is removed in another tab", async () => {
  const original = { ...stateFixture(), progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const }] }
  expect(savePlanBetaState(original)).toEqual({ ok: true })
  render(<PlanBeta />)
  await userEvent.setup().click(await screen.findByRole("button", { name: "다음 계획안 만들기" }))
  const check = screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })
  expect(check).toBeVisible()
  localStorage.removeItem(activePlanBetaStorageKey())
  storageChanged()
  expect(check).toBeVisible()
  expect(screen.getByRole("button", { name: "현재 계획으로 돌아가기" })).toBeVisible()
})

it("discards the previous scope's draft when the account changes", async () => {
  render(<PlanBeta />)
  await enterPlanWithoutRecord("5km")
  const question = screen.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u })
  act(() => setActiveLocalAccount("11111111-1111-4111-8111-111111111111"))
  expect(question).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
  act(() => setActiveLocalAccount(null))
})

it("refreshes a previously active view from the recovered storage value", async () => {
  expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
  render(<PlanBeta />)
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  const originalGet = Storage.prototype.getItem
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
    if (key === activePlanBetaStorageKey()) throw new Error("Synthetic read failure")
    return originalGet.call(this, key)
  })
  storageChanged()
  expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).not.toBeInTheDocument()
  read.mockRestore()
  localStorage.removeItem(activePlanBetaStorageKey())
  await userEvent.setup().click(screen.getByRole("button", { name: "다시 확인" }))
  expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
})

it("lets a legacy-plan athlete explicitly preserve the original and start a new intake", async () => {
  const raw = storeLegacyOriginal()
  render(<PlanBeta />)
  expect(readPlanBetaStateFromStorage()).toMatchObject({ kind: "loaded", state: { version: 2 } })
  await userEvent.setup().click(screen.getByRole("button", { name: "이전 계획을 보관하고 새 계획 만들기" }))
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
  expect(screen.getByText("보관한 이전 계획")).toBeVisible()
  expect(legacyArchive.readLegacyPlanArchives()).toMatchObject({ kind: "loaded", archives: [{ raw }] })
})

it("downloads only the explicitly chosen archived original and releases the temporary URL", async () => {
  const raw = storeLegacyOriginal()
  const create = vi.fn((_blob: Blob) => "blob:synthetic-legacy-archive"), revoke = vi.fn()
  const OriginalURL = URL
  vi.stubGlobal("URL", class extends OriginalURL { static createObjectURL = create; static revokeObjectURL = revoke })
  const clickedLinks: HTMLAnchorElement[] = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clickedLinks.push(this)
  })
  const user = userEvent.setup()
  render(<PlanBeta />)
  await user.click(screen.getByRole("button", { name: "이전 계획을 보관하고 새 계획 만들기" }))
  expect(create).not.toHaveBeenCalled()
  await user.click(screen.getByText("보관한 이전 계획"))
  await user.click(screen.getByRole("button", { name: "이전 계획 1 내려받기" }))
  expect(click).toHaveBeenCalledTimes(1)
  expect(clickedLinks[0]?.download).toMatch(/^trainoracle-previous-plan-\d{4}-\d{2}-\d{2}-1\.json$/u)
  const blob = create.mock.calls[0]![0]
  const contents = await new Promise<string>(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob)
  })
  expect(contents).toBe(raw)
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:synthetic-legacy-archive"), { timeout: 1500 })
})

it("keeps a failed legacy archive visible and lets the athlete retry without losing its raw bytes", async () => {
  const raw = storeLegacyOriginal(), user = userEvent.setup()
  const archive = vi.spyOn(legacyArchive, "archiveLegacyPlanForNewEntry").mockResolvedValueOnce({ kind: "failed", rollbackComplete: true })
  render(<PlanBeta />)
  await user.click(screen.getByRole("button", { name: "이전 계획을 보관하고 새 계획 만들기" }))
  expect(screen.getByRole("alert")).toHaveTextContent("이전 계획을 보관하지 못했어요")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "이전 계획을 보관하고 새 계획 만들기" }))
  expect(archive).toHaveBeenCalledTimes(2)
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
})

it("holds one legacy archive operation while a repeated click arrives", async () => {
  const raw = storeLegacyOriginal(), user = userEvent.setup()
  let finish!: () => void
  const held = new Promise<void>(resolve => { finish = resolve })
  const original = legacyArchive.archiveLegacyPlanForNewEntry
  const archive = vi.spyOn(legacyArchive, "archiveLegacyPlanForNewEntry").mockImplementation(async expected => {
    await held; return original(expected)
  })
  render(<PlanBeta />)
  await user.click(screen.getByRole("button", { name: "이전 계획을 보관하고 새 계획 만들기" }))
  const pending = screen.getByRole("button", { name: "이전 계획 보관 중…" })
  expect(pending).toBeDisabled()
  await user.click(pending)
  expect(archive).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  await act(async () => { finish(); await held })
  expect(legacyArchive.readLegacyPlanArchives()).toMatchObject({ kind: "loaded", archives: [{ raw }] })
})
