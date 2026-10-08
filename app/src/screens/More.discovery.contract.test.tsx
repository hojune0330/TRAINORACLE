import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

it("shows learning and decoration destinations directly in More", () => {
  const entries = [
    ["페이스 계산", "onOpenPaceCalculator"],
    ["경기 기록 추가·수정", "onOpenRecords"],
    ["워치 파일 가져오기", "onOpenImport"],
    ["러닝 취향", "onOpenRunningProfile"],
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
  fireEvent.click(screen.getByRole("button", { name: "백업·복원·휴지통" }))
  expect(screen.getByRole("button", { name: "내려받은 백업 되돌리기" })).toBeVisible()
})

it("does not advertise tools whose callbacks are unavailable", () => {
  render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "오라클 읽을거리" })).toBeNull()
  expect(screen.queryByRole("button", { name: "워치 파일 가져오기" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))
  expect(screen.getByRole("link", { name: /^기기 연동 상태/ })).toBeVisible()
})

it("returns each management view to More without leaving the screen", () => {
  const onBack = vi.fn()
  const onOpenAccount = vi.fn()
  const onOpenRestore = vi.fn()
  render(<More onBack={onBack} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()}
    onOpenAccount={onOpenAccount} onOpenRestore={onOpenRestore} />)
  expect(screen.queryByRole("button", { name: "내려받은 백업 되돌리기" })).toBeNull()
  expect(screen.queryByRole("link", { name: /^개인정보처리방침/ })).toBeNull()
  for (const name of ["계정·기록 보관", "백업·복원·휴지통", "앱 정보·개인정보·문의"]) {
    fireEvent.click(screen.getByRole("button", { name }))
    expect(screen.getByRole("heading", { level: 1, name })).toHaveFocus()
    if (name === "백업·복원·휴지통") {
      fireEvent.click(screen.getByRole("button", { name: "내려받은 백업 되돌리기" }))
      expect(onOpenRestore).toHaveBeenCalledOnce()
      expect(screen.getByText(/휴지통 ·/)).toBeVisible()
    }
    if (name === "계정·기록 보관") {
      fireEvent.click(screen.getByRole("button", { name: /계정/ }))
      expect(onOpenAccount).toHaveBeenCalledOnce()
    }
    fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
    expect(screen.getByRole("heading", { name: "더보기", level: 1 })).toBeVisible()
    expect(onBack).not.toHaveBeenCalled()
  }
  fireEvent.click(screen.getByRole("button", { name: "홈으로 돌아가기" }))
  expect(onBack).toHaveBeenCalledOnce()
})

it("keeps direct learning destinations in More while returning from external destinations", () => {
  const change = vi.fn()
  const openDecorations = vi.fn()
  const props = { onBack: vi.fn(), onOpenMinji: vi.fn(), onOpenGuide: vi.fn(), onOpenRewards: openDecorations, onViewChange: change }
  const view = render(<More {...props} view="backup" />)
  expect(screen.getByRole("heading", { name: "백업·복원·휴지통" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
  expect(change).toHaveBeenCalledWith("tools")
  view.rerender(<More {...props} view="tools" />)
  expect(screen.queryByText(/휴지통 ·/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기·포인트" }))
  expect(openDecorations).toHaveBeenCalledOnce()
  expect(change).toHaveBeenLastCalledWith("tools")
  expect(screen.getByRole("heading", { name: "더보기" })).toBeVisible()
})

it("returns a restored learning view to the More tools list", () => {
  const change = vi.fn()
  const props = { onBack: vi.fn(), onOpenMinji: vi.fn(), onOpenGuide: vi.fn(), onViewChange: change }
  const view = render(<More {...props} view="learning" />)
  expect(screen.getByRole("heading", { name: "훈련 배우기·일지 꾸미기" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
  expect(change).toHaveBeenCalledWith("tools")
  view.rerender(<More {...props} view="tools" />)
  expect(screen.getByRole("heading", { name: "더보기" })).toBeVisible()
})
