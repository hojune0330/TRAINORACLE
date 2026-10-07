import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"
import { todayISO, type JournalEntry } from "../../domain/journal-store"

const panel = vi.hoisted(() => vi.fn())
vi.mock("./PersonalOraclePanel", () => ({ PersonalOraclePanel: (props: unknown) => { panel(props); return <p>저장한 운동 요약</p> } }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); panel.mockClear() })
afterEach(cleanup)

it("offers one empty-state action and an explicitly selected example while recovery is opt-in", () => {
  const write = vi.fn(), explore = vi.fn(), recovery = vi.fn()
  render(<Trends onWriteLog={write} onOpenOracle={explore} onOpenImport={vi.fn()} onOpenRecords={vi.fn()} onWriteRecovery={recovery} />)
  const start = screen.getByRole("region", { name: "내 기록으로 시작하기" })
  expect(start.querySelectorAll("button")).toHaveLength(1)
  expect(screen.getByRole("button", { name: /운동 파일 가져오기/ })).not.toBeVisible()
  expect(screen.queryByRole("region", { name: "몸 상태와 회복 기록" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "첫 기록 남기기" }))
  expect(write).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "이 예시 자세히 보기" }))
  expect(explore).toHaveBeenCalledExactlyOnceWith("focus", "example")
  fireEvent.click(screen.getByRole("button", { name: "몸 상태·회복 기록" }))
  expect(screen.getByRole("region", { name: "몸 상태와 회복 기록" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "수면·통증·기분 남기기" }))
  expect(recovery).toHaveBeenCalledOnce()
})

it("passes only saved workout identities to the summary even when numeric provenance is absent", () => {
  const date = todayISO()
  const entry: JournalEntry = { id: "saved-no-metrics", kind: "post-session", date, savedAt: `${date}T08:00:00Z`,
    syncState: "local", system: "base", title: "private title", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }
  localStorage.setItem("trainoracle.journal.v1", JSON.stringify([entry]))
  render(<Trends onOpenOracle={vi.fn()} />)
  expect(screen.getByText("저장한 운동 요약")).toBeVisible()
  expect(panel.mock.lastCall?.[0]).toMatchObject({ savedSessions: [{ id: entry.id, date }] })
  expect(panel.mock.lastCall?.[0].savedSessions[0]).toEqual({ id: entry.id, date })
  expect(screen.queryByText("첫 운동부터 남겨볼까요?")).toBeNull()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
})

it.each(["pending", "malformed"])("does not invent an empty or saved count for %s journal reads", source => {
  if (source === "malformed") localStorage.setItem("trainoracle.journal.v1", "{")
  render(<Trends journalReadComplete={source === "pending" ? false : undefined} onOpenOracle={vi.fn()} />)
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/)).toBeVisible()
  expect(screen.queryByRole("region", { name: "내 기록으로 시작하기" })).toBeNull()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  expect(panel).not.toHaveBeenCalled()
})
