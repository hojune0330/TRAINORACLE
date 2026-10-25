import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"
import { todayISO, type JournalEntry } from "../../domain/journal-store"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-storage-keys"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { getOracleTopic } from "../../domain/oracle-exploration"

const panel = vi.hoisted(() => vi.fn())
vi.mock("./PersonalOraclePanel", () => ({ PersonalOraclePanel: (props: unknown) => { panel(props); return <p>저장한 운동 요약</p> } }))
beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture(); panel.mockClear() })
afterEach(cleanup)

it("offers one empty-state action and an explicitly selected example while recovery is opt-in", () => {
  const write = vi.fn(), explore = vi.fn(), recovery = vi.fn(), importFile = vi.fn(), saveRecord = vi.fn()
  render(<Trends onWriteLog={write} onOpenOracle={explore} onOpenImport={importFile} onOpenRecords={saveRecord} onWriteRecovery={recovery} />)
  expect(screen.getAllByRole("button", { name: "운동 기록 쓰기" })).toHaveLength(1)
  const importButton = screen.getByRole("button", { name: /운동 파일 가져오기/ })
  expect(importButton).toBeVisible()
  expect(screen.getByRole("button", { name: /최고기록 남기기/ })).toBeVisible()
  expect(screen.queryByRole("region", { name: "몸 상태와 회복 기록" })).toBeNull()
  expect(screen.queryByText(getOracleTopic("focus").example.headline)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "운동 기록 쓰기" }))
  expect(write).toHaveBeenCalledOnce()
  fireEvent.click(importButton)
  expect(importFile).toHaveBeenCalledOnce()
  const example = screen.getByRole("button", { name: "예시 결과 보기" })
  fireEvent.click(example)
  expect(screen.getByRole("region", { name: "기간별 훈련 리포트" })).toHaveAttribute("data-source", "example")
  expect(explore).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
  fireEvent.click(screen.getByRole("button", { name: "몸 상태·회복 기록" }))
  expect(screen.getByRole("region", { name: "몸 상태와 회복 기록" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "컨디션 기록" }))
  expect(recovery).toHaveBeenCalledOnce()
})

it("keeps private workout text out of a report when numeric provenance is absent", () => {
  const date = todayISO()
  const entry: JournalEntry = { id: "saved-no-metrics", kind: "post-session", date, savedAt: `${date}T08:00:00Z`,
    syncState: "local", system: "base", title: "private title", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([entry]))
  render(<Trends onOpenOracle={vi.fn()} />)
  expect(screen.getByRole("region", { name: "기간별 훈련 리포트" })).toHaveAttribute("data-source", "my")
  expect(screen.queryByText("private title")).toBeNull()
  expect(screen.queryByRole("img")).toBeNull()
  expect(screen.queryByText("첫 운동부터 남겨볼까요?")).toBeNull()
  expect(screen.getByRole("button", { name: "예시 결과 보기" })).toBeVisible()
})

it.each(["pending", "malformed"])("does not invent an empty or saved count for %s journal reads", source => {
  if (source === "malformed") localStorage.setItem(JOURNAL_STORAGE_KEY, "{")
  render(<Trends journalReadComplete={source === "pending" ? false : undefined} onOpenOracle={vi.fn()} />)
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/)).toBeVisible()
  expect(screen.queryByRole("region", { name: "내 기록으로 시작하기" })).toBeNull()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  expect(panel).not.toHaveBeenCalled()
  for (const label of ["훈련량", "훈련 구성", "월별 변화"]) {
    fireEvent.click(screen.getByRole("button", { name: label }))
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).toBeNull()
    expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).toBeNull()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).toBeNull()
    expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/)).toBeVisible()
  }
})
