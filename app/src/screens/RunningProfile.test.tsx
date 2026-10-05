import React from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RunningProfile } from "./RunningProfile"
import type { RunningProfileStage } from "../domain/running-profile"
import { runningProfileEditToken, type RunningProfileStore } from "../domain/account/account-running-profile-service"
const mocks = vi.hoisted(() => ({ owner: null as string | null, complete: true, recordStatus: "READY", metric: "RPE", result: vi.fn(), enabled: false, create: vi.fn() }))
vi.mock("../domain/account/account-running-profile-service", async importOriginal => ({ ...await importOriginal<typeof import("../domain/account/account-running-profile-service")>(), createRunningProfileService: mocks.create }))
vi.mock("../domain/account/local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner }))
vi.mock("../domain/account/account-journal-api", () => ({ accountJournalPreviewEnabled: () => mocks.enabled }))
vi.mock("../hooks/useAthleteRecordsSnapshot", () => ({ useAthleteRecordsSnapshot: () => ({ status: mocks.recordStatus, records: [], message: "계정 기록 조회 실패" }) }))
vi.mock("../hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: mocks.complete }) }))
vi.mock("../domain/journal-store", () => ({ loadEntries: () => [] }))
vi.mock("../domain/oracle-personal-result", () => ({ buildOraclePersonalResult: () => mocks.result() }))
beforeEach(() => {
  mocks.owner = null; mocks.complete = true; mocks.recordStatus = "READY"; mocks.metric = "RPE"; mocks.enabled = false
  mocks.result.mockImplementation(() => ({ headline: "월별 기록", summary: "확인한 범위", source: "실제 기록", rows: [], detail: "조건은 달라요", metric: mocks.metric }))
})
afterEach(cleanup)
function Harness() {
  const [stages, setStages] = React.useState<RunningProfileStage[]>(["overview"])
  return <RunningProfile stage={stages[stages.length - 1]!} today="2026-10-04"
    onStageChange={stage => setStages(current => [...current, stage])}
    onBack={() => setStages(current => current.slice(0, -1))} onClose={vi.fn()} />
}
async function initial() {
  const user = userEvent.setup(); render(<Harness />)
  await user.click(screen.getByRole("button", { name: "3문항으로 시작" }))
  await user.click(screen.getByRole("button", { name: "건강과 체력" }))
  await user.click(screen.getByRole("button", { name: "기분 전환" }))
  await user.click(screen.getByRole("button", { name: "다음" }))
  await user.click(screen.getByRole("button", { name: "대화할 수 있는 강도" }))
  await user.click(screen.getByRole("button", { name: "혼자" }))
  return user
}
it("finishes three questions without a forced survey or guest writes", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem"); const user = await initial()
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("건강과 체력 · 기분 전환")
  expect(screen.getByText(/저장 없는 체험/)).toBeVisible()
  expect(storage).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "이전 단계로" }))
  expect(screen.getByRole("button", { name: "혼자" })).toHaveAttribute("aria-pressed", "true")
  storage.mockRestore()
})
it("keeps responses across result tabs and does not interpret distance as response", async () => {
  const user = await initial(); mocks.metric = "DISTANCE_KM"
  await user.click(within(screen.getByRole("navigation", { name: "러닝 프로필 항목" })).getByRole("button", { name: "변화" }))
  expect(screen.getByText(/거리만으로 몸의 반응을 판단하지 않아요/)).toBeVisible()
  expect(screen.queryByText("월별 기록")).toBeNull()
  await user.click(screen.getByRole("button", { name: "취향" }))
  expect(screen.getByText("건강과 체력 · 기분 전환", { selector: "dd" })).toBeVisible()
})
it("lets all optional questions be skipped and preserves the first responses", async () => {
  const user = await initial()
  await user.click(screen.getByRole("button", { name: /대회·종목·운동 취향 더하기/ }))
  for (let i = 0; i < 6; i++) await user.click(screen.getByRole("button", { name: "지금은 건너뛰기" }))
  expect(screen.getByText("건강과 체력 · 기분 전환", { selector: "dd" })).toBeVisible()
  expect(screen.queryByText("관심 종목", { selector: "dt" })).toBeNull()
})
it("allows partial answers without converting unknown to a low score", async () => {
  const user = userEvent.setup(); render(<Harness />)
  await user.click(screen.getByRole("button", { name: "3문항으로 시작" }))
  await user.click(screen.getByRole("button", { name: "지금은 건너뛰기" }))
  await user.click(screen.getByRole("button", { name: "아직 모르겠어요" }))
  await user.click(screen.getByRole("button", { name: "지금은 건너뛰기" }))
  expect(screen.getByRole("heading", { name: "아직 정하지 않아도 괜찮아요" })).toBeVisible()
  expect(screen.getByText("아직 모르겠어요", { selector: "dd" })).toBeVisible()
})
it("shows account storage failure, not guest success, with answers retained", async () => {
  mocks.owner = "account-test"
  await initial()
  expect(screen.getByText("계정 응답을 확인하지 못했어요")).toBeVisible()
  expect(screen.getByText("건강과 체력 · 기분 전환", { selector: "dd" })).toBeVisible()
  expect(screen.queryByText("계정에 저장했어요.")).toBeNull()
  expect(screen.getByRole("button", { name: "계정에 저장" })).toBeDisabled()
})
it("does not label an incomplete journal or record fetch as no data", async () => {
  mocks.complete = false; mocks.recordStatus = "UNAVAILABLE"
  const user = userEvent.setup(); render(<Harness />)
  await user.click(screen.getByRole("button", { name: "최근 훈련" }))
  expect(screen.getByText(/일지를 모두 확인하지 못했어요/)).toBeVisible()
  await user.click(screen.getByRole("button", { name: "경기 기록" }))
  expect(screen.getByText("계정 기록 조회 실패")).toBeVisible()
})

it("reviews a newer account response before saving the screen's retained answers", async () => {
  mocks.owner = "account-test"; mocks.enabled = true
  let state: RunningProfileStore = { status: "EMPTY", document: null, revision: 0, sequence: 0, remote: null, remoteRevision: null }
  let changed!: (value: RunningProfileStore) => void
  const save = vi.fn(async (answers, token) => {
    if (state.revision === 0) {
      state = { ...state, status: "READY", revision: 1, sequence: 1, document: { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: { version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T00:00:00.000Z", answers: { motives: ["record"] } } } }
      changed(state); return false
    }
    expect(token).toBe(runningProfileEditToken(state))
    state = { ...state, revision: 2, sequence: 2, document: { ...state.document!, data: { ...state.document!.data, answers } } }
    changed(state); return true
  })
  mocks.create.mockImplementation((_owner, publish) => {
    changed = publish
    return { hydrate: async () => { changed(state); return true }, save, snapshot: () => state, close: vi.fn() }
  })
  const user = await initial()
  expect(screen.getByRole("heading", { name: "편집 중 계정 응답이 바뀌었어요" })).toBeVisible()
  expect(screen.getByText("건강과 체력 · 기분 전환", { selector: "dd" })).toBeVisible()
  expect(save).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole("button", { name: "이 화면 응답으로 저장" }))
  expect(save).toHaveBeenCalledTimes(2)
  expect(screen.getByText("계정에 저장했어요.")).toBeVisible()
})
