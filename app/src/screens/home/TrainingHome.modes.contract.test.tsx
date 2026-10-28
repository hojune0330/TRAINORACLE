import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { buildTrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HomeOraclePreview } from "./HomeOraclePreview"

const BASE = buildTrainingHomeViewModel([], [], null, "2026-10-27")
afterEach(cleanup)
beforeEach(() => localStorage.clear())

it.each(["WELCOME", "TRAINING", "JOURNAL"] as const)("keeps one accented home title for %s", homeMode => {
  const { container } = render(<TrainingHome model={{ ...BASE, homeMode }} />)
  expect(screen.getByRole("heading", { level: 1, name: "훈련과 기록" })).toHaveClass("app-heading--hero", "app-heading--accent")
  expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
  expect(screen.getByRole("region", { name: "오늘의 기록" })).toBeVisible()
})

it("keeps the neutral personal analysis destination without fictional previews", () => {
  const open = vi.fn()
  render(<TrainingHome model={BASE} onOpenOracle={open} oraclePreview={<HomeOraclePreview kind="example" question="예시 결과" answer="가상 기록" sourceLabel="예시 데이터" onOpen={vi.fn()} />} />)
  expect(screen.queryByText(/예시|가상 기록/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "내 기록 분석" }))
  expect(open).toHaveBeenCalledWith("level")
})

it("keeps a plan checklist out of Oracle analysis even when that component is used elsewhere", () => {
  render(<HomeOraclePreview kind="plan" question="저장한 훈련 계획" answer="계획 9회 · 완료 체크 1회" sourceLabel="계획 체크" onOpen={vi.fn()} />)
  expect(screen.queryByRole("region", { name: "오라클 · 내 계획 진행" })).toBeNull()
  expect(screen.queryByText("계획 9회 · 완료 체크 1회")).toBeNull()
})

it("keeps short useful destinations in order and notices in their own lower area", () => {
  const trends = vi.fn(), guide = vi.fn(), learn = vi.fn(), decorate = vi.fn()
  render(<TrainingHome model={BASE} onOpenTrends={trends} onOpenGuide={guide} onOpenContent={learn} onOpenRewards={decorate}
    installSuggestion={<button>앱 추가</button>} announcement={<button>소식 닫기</button>} />)
  const nav = screen.getByRole("navigation", { name: "홈 바로가기" })
  const buttons = within(nav).getAllByRole("button")
  expect(buttons.map(button => button.textContent)).toEqual(["훈련법", "꾸미기"])
  expect(buttons.map(button => button.getAttribute("data-category"))).toEqual(["training", "journal"])
  buttons.forEach(button => fireEvent.click(button))
  expect(trends).not.toHaveBeenCalled(); expect(learn).toHaveBeenCalledOnce(); expect(decorate).toHaveBeenCalledOnce()
  expect(guide).not.toHaveBeenCalled()
  const notices = screen.getByRole("complementary", { name: "소식과 설치 안내" })
  expect(within(notices).getByRole("button", { name: "앱 추가" })).toBeVisible()
  expect(nav.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(screen.getByRole("button", { name: "더보기" })).toHaveAttribute("data-install-shortcut-return", "home")
})

it("does not render unavailable shortcut groups or example-only navigation", () => {
  render(<TrainingHome model={BASE} onOpenGuide={vi.fn()} />)
  expect(screen.queryByRole("navigation", { name: "홈 바로가기" })).toBeNull()
})

it("keeps safety before work and history after work without exposing unsupported analysis summaries", () => {
  const model = { ...BASE, homeMode: "JOURNAL" as const, showMinjiPrompt: false, todayRecordCount: 2, briefing: "오늘 기록 · 수면 7h", analysisSummary: "이번 주 12km" }
  const { rerender } = render(<TrainingHome model={model} safetyNotice={<p data-testid="safety">안전 안내</p>} recentJournal={<p data-testid="recent">보관된 기록</p>} />)
  const work = screen.getByRole("region", { name: "오늘의 기록" })
  expect(screen.getByRole("banner").nextElementSibling).toBe(screen.getByTestId("safety"))
  expect(screen.getByTestId("safety").compareDocumentPosition(work) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(work.compareDocumentPosition(screen.getByTestId("recent")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(screen.getByRole("button", { name: "남긴 기록 2개" })).toBeVisible()
  expect(screen.queryByText("이번 주 12km")).toBeNull()
  rerender(<TrainingHome model={model} journalReadiness="STALE" recentJournal={<p>보관된 기록</p>} />)
  expect(screen.queryByRole("button", { name: "남긴 기록 2개" })).toBeNull()
  expect(screen.queryByText("오늘 기록 · 수면 7h")).toBeNull()
  expect(screen.getByText("보관된 기록")).toBeVisible()
})
