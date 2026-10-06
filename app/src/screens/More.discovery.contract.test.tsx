import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

it("names available tools directly instead of hiding them inside help", () => {
  const entries = [
    ["페이스 계산", "onOpenPaceCalculator"],
    ["경기 기록 추가·수정", "onOpenRecords"],
    ["워치 파일 가져오기", "onOpenImport"],
    ["나의 러닝 프로필", "onOpenRunningProfile"],
    ["최고기록으로 풀이하기", "onOpenRecordReading"],
    ["오라클 읽을거리", "onOpenOracleLibrary"],
    ["훈련법 읽기", "onOpenContent"],
    ["일지 꾸미기·포인트", "onOpenRewards"],
    ["민지의 예시 일지", "onOpenMinji"],
    ["훈련 용어집·도움말", "onOpenGuide"],
  ] as const
  const actions = Object.fromEntries(entries.map(([, key]) => [key, vi.fn()]))
  render(<More onBack={vi.fn()} onOpenMinji={actions.onOpenMinji!} onOpenGuide={actions.onOpenGuide!} onOpenRestore={vi.fn()} {...actions} />)
  for (const [name, key] of entries) {
    const button = screen.getByRole("button", { name })
    expect(button).toBeVisible()
    expect(button.closest("details")).toBeNull()
    fireEvent.click(button)
    expect(actions[key]).toHaveBeenCalledOnce()
  }
  expect(screen.getByText("저장 없이 내 기록·친구 기록 비교")).toBeVisible()
  expect(screen.getByRole("button", { name: "내려받은 백업 되돌리기" })).toBeVisible()
})

it("does not advertise tools whose callbacks are unavailable", () => {
  render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "오라클 읽을거리" })).toBeNull()
  expect(screen.queryByRole("button", { name: "워치 파일 가져오기" })).toBeNull()
  expect(screen.getByRole("link", { name: /^기기 연동 상태/ })).toBeVisible()
})
