import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { More } from "./More"

afterEach(cleanup)

it("replays the app introduction and returns to its exact opener and reader scroll", async () => {
  const plan = vi.fn(), analysis = vi.fn()
  render(<div className="app-scroll-region"><More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()}
    onOpenPlan={plan} onOpenAnalysis={analysis} /></div>)
  const region = document.querySelector<HTMLElement>(".app-scroll-region")!
  region.scrollTop = 430
  fireEvent.click(screen.getByRole("button", { name: "앱 소개" }))
  expect(screen.getByRole("heading", { level: 1, name: "앱 소개" })).toHaveFocus()
  expect(screen.getByRole("heading", { level: 2, name: "운동을 분석하고 훈련 계획을 세워요" })).toBeVisible()
  expect(screen.queryByText(/내 기록 결과/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "훈련 계획 보기" }))
  fireEvent.click(screen.getByRole("button", { name: "운동 분석 보기" }))
  expect(plan).toHaveBeenCalledOnce(); expect(analysis).toHaveBeenCalledOnce()
  region.scrollTop = 0
  fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "앱 소개" })).toHaveFocus())
  expect(region.scrollTop).toBe(430)
  fireEvent.click(screen.getByRole("button", { name: "앱 소개" }))
  expect(screen.getByRole("heading", { name: "앱 소개", level: 1 })).toBeVisible()
})

it("restores the management opener and scroll when returning to More", async () => {
  render(<div className="app-scroll-region"><More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} /></div>)
  const region = document.querySelector<HTMLElement>(".app-scroll-region")!
  region.scrollTop = 350
  const opener = screen.getByRole("button", { name: "백업·복원·휴지통" })
  fireEvent.click(opener)
  region.scrollTop = 0
  fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "백업·복원·휴지통" })).toHaveFocus())
  expect(region.scrollTop).toBe(350)
})

it("does not repeat a destination name as a heading or supporting description", () => {
  render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} onOpenRewards={vi.fn()} />)
  expect(screen.getByRole("button", { name: "일지 꾸미기" })).not.toHaveAccessibleDescription()
  expect(screen.queryByRole("heading", { name: "일지 꾸미기", level: 2 })).toBeNull()
})

it("shows learning and decoration destinations directly in More", () => {
  const entries = [
    ["페이스 계산", "onOpenPaceCalculator"],
    ["경기 기록 추가·수정", "onOpenRecords"],
    ["워치 파일 가져오기", "onOpenImport"],
    ["러닝 취향", "onOpenRunningProfile"],
    ["최고기록으로 풀이하기", "onOpenRecordReading"],
    ["오라클 읽을거리", "onOpenOracleLibrary"],
    ["훈련법 읽기", "onOpenContent"],
    ["일지 꾸미기", "onOpenRewards"],
    ["게임 라운지", "onOpenMinigame"],
    ["일지 예시 보기", "onOpenMinji"],
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
  expect(within(screen.getByRole("region", { name: "배우기" })).getByRole("button", { name: "일지 예시 보기" })).toBeVisible()
  expect(within(screen.getByRole("region", { name: "배우기" })).queryByRole("button", { name: "게임 라운지" })).toBeNull()
  expect(within(screen.getByRole("region", { name: "꾸미기·게임" })).getByRole("button", { name: "일지 꾸미기" })).toBeVisible()
  expect(within(screen.getByRole("region", { name: "꾸미기·게임" })).getByRole("button", { name: "게임 라운지" })).toBeVisible()
  for (const name of ["러닝 취향", "최고기록으로 풀이하기", "게임 라운지"]) {
    expect(screen.getByRole("button", { name })).toHaveTextContent(new RegExp(`^${name}$`))
    expect(screen.getByRole("button", { name })).not.toHaveAccessibleDescription()
  }
  fireEvent.click(screen.getByRole("button", { name: "백업·복원·휴지통" }))
  expect(screen.getByRole("button", { name: "내려받은 백업 되돌리기" })).toBeVisible()
})

it("does not advertise tools whose callbacks are unavailable", () => {
  render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "오라클 읽을거리" })).toBeNull()
  expect(screen.queryByRole("button", { name: "워치 파일 가져오기" })).toBeNull()
  const about = screen.getByRole("button", { name: "앱 정보·개인정보·문의" })
  expect(about).not.toHaveAccessibleDescription()
  fireEvent.click(about)
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
  fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
  expect(openDecorations).toHaveBeenCalledOnce()
  expect(change).toHaveBeenLastCalledWith("tools")
  expect(screen.getByRole("heading", { name: "더보기" })).toBeVisible()
})

it("returns a restored learning view to the More tools list", () => {
  const change = vi.fn()
  const props = { onBack: vi.fn(), onOpenMinji: vi.fn(), onOpenGuide: vi.fn(), onViewChange: change }
  const view = render(<More {...props} view="learning" />)
  expect(screen.getByRole("heading", { name: "훈련 배우기" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
  expect(change).toHaveBeenCalledWith("tools")
  view.rerender(<More {...props} view="tools" />)
  expect(screen.getByRole("heading", { name: "더보기" })).toBeVisible()
})
