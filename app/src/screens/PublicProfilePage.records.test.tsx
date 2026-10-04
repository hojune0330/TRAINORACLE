import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountAthleteRecordsState } from "../domain/account/account-athlete-record-service"
import type { AthleteRecord } from "../domain/athlete-records"
import type { AccountUser } from "../domain/account/auth"

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(), authChange: undefined as undefined | ((user: AccountUser | null) => void),
  state: {} as AccountAthleteRecordsState, save: vi.fn(), loadOwn: vi.fn(), loadShared: vi.fn(), friendDistance: 5000,
}))
vi.mock("../domain/account/config", () => ({ accountFeatureEnabled: () => true }))
vi.mock("../domain/account/auth", () => ({
  currentUser: mocks.currentUser,
  onAuthChange: (listener: typeof mocks.authChange) => { mocks.authChange = listener; return () => { mocks.authChange = undefined } },
}))
vi.mock("../domain/account/account-service", () => ({
  loadPrivateProfileSetupStatus: vi.fn().mockResolvedValue({ ok: true, ready: true }),
}))
vi.mock("../domain/account/account-athlete-record-service", () => ({
  ACCOUNT_ATHLETE_RECORD_EVENT: "trainoracle:account-athlete-records-changed",
  accountAthleteRecordsEnabled: () => true,
  readAccountAthleteRecordsState: () => mocks.state,
}))
vi.mock("../domain/account/public-profile", () => ({
  PUBLIC_PROFILE_TAG_LABELS: { TRAINING_CONSISTENTLY: "꾸준히 훈련하고 있어요" },
  loadPublicProfile: async () => ({ profile: { handle: "friend", displayName: "Friend", profileTag: "TRAINING_CONSISTENTLY" }, cards: [], oracleSnapshot: { ...shared, record: { ...shared.record, eventDistanceM: mocks.friendDistance } } }),
  loadOwnPublicProfile: mocks.loadOwn, savePublicProfile: mocks.save, publishActivePlanCard: mocks.save,
  publicProfileUrl: () => "https://example.invalid/?profile=friend",
}))
vi.mock("../domain/account/oracle-comparison-sharing", () => ({
  loadOwnOracleComparisonSnapshot: mocks.loadShared, saveOwnOracleComparisonSnapshot: mocks.save,
}))
import { PublicProfilePage } from "./PublicProfilePage"
import { PublicProfileSettings } from "./account/PublicProfileSettings"
import { ATHLETE_RECORDS_STORAGE_KEY } from "../domain/athlete-records"
import { activeLocalAccount, setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const record = (id: string, seconds: number): AthleteRecord => ({
  schemaVersion: 1, id, purpose: "PERSONAL_BEST", eventDistanceM: 5000, performanceSeconds: seconds,
  achievedOn: "2024-03-10", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
  sourceRef: `athlete-record:${id}`, savedAt: "2026-07-27T03:00:00.000Z",
})
const shared = { schemaVersion: 1, sharedFields: ["BEST_RECORD"], record: { eventDistanceM: 5000, bestSeconds: 1000 }, recent8WeekDistanceKm: null, structuredSessionCount: null, energySessionCounts: [] }
const user = (id: string): AccountUser => ({ id, email: null, phone: null, provider: null })
function publish(ownerId: string, records: AthleteRecord[], status: AccountAthleteRecordsState["status"] = "READY") {
  act(() => {
    mocks.state = { ownerId, records, status, confirmed: status === "READY", documentId: "synthetic", serverRevision: 1 }
    window.dispatchEvent(new Event("trainoracle:account-athlete-records-changed"))
  })
}
beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(null); vi.clearAllMocks()
  mocks.friendDistance = 5000
  mocks.state = { status: "IDLE", ownerId: null, records: [], confirmed: false, documentId: null, serverRevision: null }
  mocks.loadOwn.mockResolvedValue(null); mocks.loadShared.mockResolvedValue(null)
  localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([record("guest", 500)]))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); localStorage.clear() })

it("waits for direct-entry auth and late account records, never comparing guest data as account data", async () => {
  let resolve!: (value: AccountUser | null) => void
  mocks.currentUser.mockReturnValue(new Promise<AccountUser | null>(done => { resolve = done }))
  render(<PublicProfilePage handle="friend" />)
  expect(await screen.findByText("Friend")).toBeVisible()
  expect(screen.getByRole("status")).toHaveTextContent("로그인 상태")
  expect(screen.queryByRole("button", { name: "내 기록과 비교하기" })).toBeNull()
  await act(async () => resolve(user("account-a")))
  await vi.waitFor(() => expect(activeLocalAccount()).toBe("account-a"))
  expect(screen.getByRole("status")).toHaveTextContent("경기 기록을 불러오고")
  publish("account-a", [record("account", 900)])
  fireEvent.click(screen.getByRole("button", { name: "내 기록과 비교하기" }))
  expect(screen.getByText(/기록 차이는 10%/)).toBeVisible()
  expect(screen.queryByText(/기록 차이는 50%/)).toBeNull()
  mocks.currentUser.mockResolvedValue(user("account-b"))
  act(() => mocks.authChange?.(user("account-b")))
  expect(screen.queryByRole("region", { name: "친구와 함께 달리기 비교 결과" })).toBeNull()
  publish("account-b", [], "EMPTY")
  await vi.waitFor(() => expect(activeLocalAccount()).toBe("account-b"))
  expect(screen.getByText(/내 경기 기록이나 거리/)).toBeVisible()
  expect(mocks.save).not.toHaveBeenCalled()
})

it("preserves confirmed guest comparison and treats failed login as unavailable, not guest", async () => {
  mocks.currentUser.mockRejectedValueOnce(new Error("offline"))
  const view = render(<PublicProfilePage handle="friend" />)
  expect(await screen.findByText(/로그인 상태를 확인하지 못했어요/)).toBeVisible()
  expect(screen.queryByRole("button", { name: "내 기록과 비교하기" })).toBeNull()
  view.unmount()
  mocks.currentUser.mockResolvedValueOnce(null)
  render(<PublicProfilePage handle="friend" />)
  fireEvent.click(await screen.findByRole("button", { name: "내 기록과 비교하기" }))
  expect(screen.getByText("게스트 · 이 기기의 내 기록")).toBeVisible()
  expect(screen.getByText(/기록 차이는 50%/)).toBeVisible()
})

it("ignores stale initial authentication after a newer account event and separates failed records from empty", async () => {
  let resolve!: (value: AccountUser | null) => void
  mocks.currentUser.mockReturnValue(new Promise<AccountUser | null>(done => { resolve = done }))
  render(<PublicProfilePage handle="friend" />)
  await screen.findByText("Friend")
  mocks.currentUser.mockResolvedValue(user("account-b"))
  act(() => mocks.authChange?.(user("account-b")))
  await act(async () => resolve(user("account-a")))
  await vi.waitFor(() => expect(activeLocalAccount()).toBe("account-b"))
  publish("account-b", [], "FAILED")
  expect(screen.getByRole("status")).toHaveTextContent("경기 기록을 확인하지 못했어요")
  expect(screen.queryByText(/내 경기 기록이나 거리/)).toBeNull()
  publish("account-b", [record("b", 800)])
  fireEvent.click(screen.getByRole("button", { name: "내 기록과 비교하기" }))
  expect(screen.getByText(/기록 차이는 20%/)).toBeVisible()
})

it("updates mounted settings without reloading consent or overwriting edited selections", async () => {
  setActiveLocalAccount("account-a")
  mocks.loadOwn.mockResolvedValue({ handle: "runner", displayName: "Runner", profileTag: "TRAINING_CONSISTENTLY", isPublic: true })
  mocks.loadShared.mockResolvedValue(shared)
  const view = render(<PublicProfileSettings userId="account-a" />)
  const select = await screen.findByRole("combobox", { name: "비교에 공개할 경기 기록" })
  expect(select).toHaveValue("")
  publish("account-a", [record("saved", 1000), record("new", 900)])
  expect(select).toHaveValue("saved")
  fireEvent.change(select, { target: { value: "new" } })
  fireEvent.click(screen.getByRole("checkbox", { name: "최근 8주 거리 합계" }))
  publish("account-a", [record("saved", 1000), record("new", 900), record("late", 800)])
  expect(select).toHaveValue("new")
  expect(screen.getByRole("checkbox", { name: "최근 8주 거리 합계" })).toBeChecked()
  expect(mocks.loadOwn).toHaveBeenCalledTimes(1)
  expect(mocks.loadShared).toHaveBeenCalledTimes(1)
  expect(mocks.save).not.toHaveBeenCalled()
  mocks.loadOwn.mockResolvedValue(null); mocks.loadShared.mockResolvedValue(null)
  act(() => setActiveLocalAccount("account-b"))
  view.rerender(<PublicProfileSettings userId="account-b" />)
  expect(screen.getByRole("checkbox", { name: /다른 사람이 내 프로필/ })).not.toBeChecked()
  expect(screen.queryByRole("combobox", { name: "비교에 공개할 경기 기록" })).toBeNull()
})

it.each([[21097, 21097.5], [21097.5, 21097]])("matches own half %s with public half %s ahead of an unrelated faster event", async (ownDistance, friendDistance) => {
  mocks.friendDistance = friendDistance
  mocks.currentUser.mockResolvedValue(user("account-a"))
  render(<PublicProfilePage handle="friend" />)
  await screen.findByText("Friend")
  publish("account-a", [record("unrelated", 500), { ...record("half", 900), eventDistanceM: ownDistance }])
  fireEvent.click(await screen.findByRole("button", { name: "내 기록과 비교하기" }))
  expect(screen.getByText(/21097.5m 기록 차이는 10%/)).toBeVisible()
})

it("restores a legacy half selection when the saved shared snapshot uses the canonical distance", async () => {
  setActiveLocalAccount("account-a")
  mocks.loadOwn.mockResolvedValue({ handle: "runner", displayName: "Runner", profileTag: "TRAINING_CONSISTENTLY", isPublic: true })
  mocks.loadShared.mockResolvedValue({ ...shared, record: { eventDistanceM: 21097.5, bestSeconds: 1000 } })
  render(<PublicProfileSettings userId="account-a" />)
  const select = await screen.findByRole("combobox", { name: "비교에 공개할 경기 기록" })
  publish("account-a", [{ ...record("legacy-half", 1000), eventDistanceM: 21097 }])
  expect(select).toHaveValue("legacy-half")
  expect(mocks.save).not.toHaveBeenCalled()
})

it("does not enable sharing on record arrival and blocks publishing an unavailable selected record", async () => {
  setActiveLocalAccount("account-a")
  mocks.loadOwn.mockResolvedValue({ handle: "runner", displayName: "Runner", profileTag: "TRAINING_CONSISTENTLY", isPublic: true })
  render(<PublicProfileSettings userId="account-a" />)
  const consent = await screen.findByRole("checkbox", { name: /친구가 내 기록과 비교/ })
  await act(async () => undefined)
  publish("account-a", [record("new", 900)])
  expect(consent).not.toBeChecked()
  expect(mocks.save).not.toHaveBeenCalled()
  fireEvent.click(consent)
  fireEvent.click(screen.getByRole("checkbox", { name: "내가 고른 경기 기록 1개" }))
  fireEvent.change(screen.getByRole("combobox", { name: "비교에 공개할 경기 기록" }), { target: { value: "new" } })
  publish("account-a", [record("new", 900)], "FAILED")
  fireEvent.click(screen.getByRole("button", { name: "친구 비교 공개 설정 저장" }))
  expect(screen.getByText("공개할 경기 기록을 다시 확인해 주세요.")).toBeVisible()
  expect(mocks.save).not.toHaveBeenCalled()
})
