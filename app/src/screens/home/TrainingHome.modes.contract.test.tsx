import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HomeOraclePreview } from "./HomeOraclePreview"

const BASE = { homeMode: "WELCOME", todayMessage: "아직 오늘 기록이 없어요.", todayRecordCount: 0, journalSummary: "아직 기록이 없어요", flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택", planSummary: "저장된 계획 없음 · 계획안 만들기", analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요", showMinjiPrompt: true, nextTraining: null, briefing: "" } satisfies TrainingHomeViewModel
const TRAINING = { ...BASE, homeMode: "TRAINING", planSummary: "저장된 계획 · 2개 일정", nextTraining: { date: "2026-08-20", laterSameDaySession: null, session: { day: 2, slot: "PM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 5, maximum: 6 }, durationMinutes: { minimum: 25, maximum: 40 } } } } } satisfies TrainingHomeViewModel

afterEach(cleanup)
beforeEach(() => {
  window.localStorage.clear()
})

describe("training home presentation", () => {
  it.each([
    { model: BASE, title: "오늘 운동을 기록해요" },
    { model: TRAINING, title: "오늘의 훈련" },
    { model: { ...BASE, homeMode: "JOURNAL" } satisfies TrainingHomeViewModel, title: "내 기록" },
  ])("uses one accented hero and section headings for $title", ({ model, title }) => {
    const { container } = render(<TrainingHome model={model} />)
    const hero = screen.getByRole("heading", { level: 1, name: title })
    expect(hero).toHaveClass("app-heading--hero", "app-heading--accent")
    expect(hero).toHaveAttribute("id", "home-hub-title")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 2, name: "오늘" })).toHaveClass("app-heading--section")
    expect(container.querySelectorAll(".home-hub__primary")).toHaveLength(1)
    if (model.homeMode === "TRAINING") {
      expect(screen.getByRole("heading", { level: 2, name: "다음 훈련" })).toHaveClass("app-heading--section")
    }
    if (model.homeMode !== "WELCOME") {
      expect(screen.getByRole("heading", { level: 2, name: "최근 하루 기록" })).toHaveClass("app-heading--section")
    }
  })

  it("keeps the today action visible and uses a neutral Oracle fallback without a prepared result", () => {
    const explore = vi.fn()
    render(<TrainingHome model={BASE} onOpenOracle={explore} />)
    expect(screen.getByRole("button", { name: "오라클 결과 보기" })).toBeVisible()
    expect(screen.getByText(BASE.todayMessage)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "오늘 기록 남기기" }))
    fireEvent.click(screen.getByRole("button", { name: "오라클 결과 보기" }))
    expect(explore).toHaveBeenCalledWith("level")
  })
  it("shows one prepared result with its supplied source dates and opens its existing destination", () => {
    const open = vi.fn()
    render(<TrainingHome model={TRAINING} oraclePreview={<HomeOraclePreview
      kind="personal"
      question="최근 경기 기록을 비교했어요"
      answer="같은 종목에 저장한 두 기록을 나란히 볼 수 있어요."
      sourceLabel="출처 · 경기 기록 · 2026.09.12 / 2026.09.28"
      onOpen={open}
    />} />)
    expect(screen.getByRole("region", { name: "오라클 · 내 기록 결과" })).not.toBeVisible()
    fireEvent.click(screen.getByText("내 오라클 살펴보기"))
    const preview = screen.getByRole("region", { name: "오라클 · 내 기록 결과" })
    expect(preview).toHaveAttribute("data-oracle-kind", "personal")
    expect(within(preview).getByText(/2026\.09\.12 \/ 2026\.09\.28/u)).toBeVisible()
    expect(screen.getAllByRole("region", { name: /오라클/u })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: / · 결과 보기$/u })).not.toBeInTheDocument()
    fireEvent.click(within(preview).getByRole("button", { name: "이 결과 자세히 보기" }))
    expect(open).toHaveBeenCalledOnce()
  })
  it("keeps welcome concise and exposes learning and decoration entry points", () => {
    const learn = vi.fn(); const decorate = vi.fn(); const guide = vi.fn()
    render(<TrainingHome model={BASE} onOpenContent={learn} onOpenRewards={decorate} onOpenGuide={guide} />)
    expect(screen.getByRole("heading", { name: "오늘 운동을 기록해요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련법 읽기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지 꾸미기" })).toBeVisible()
    expect(screen.getByRole("navigation", { name: "오늘 기록 또는 계획 만들기" }).querySelectorAll("button")).toHaveLength(3)
    fireEvent.click(screen.getByRole("button", { name: "훈련법 읽기" })); fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    fireEvent.click(screen.getByRole("button", { name: "일지 예시 보기" }))
    expect(learn).toHaveBeenCalledOnce(); expect(decorate).toHaveBeenCalledOnce()
    expect(guide).toHaveBeenCalledOnce()
  })
  it("marks an example as an example in the Oracle preview", () => {
    render(<TrainingHome model={BASE} oraclePreview={<HomeOraclePreview
      kind="example"
      question="예시 결과는 이렇게 읽어요"
      answer="가상 기록으로 결과 화면을 먼저 둘러볼 수 있어요."
      sourceLabel="출처 · 예시 데이터"
      onOpen={vi.fn()}
    />} />)
    expect(screen.getByText("출처 · 예시 데이터")).not.toBeVisible()
    fireEvent.click(screen.getByText("오라클 결과 예시 보기"))
    expect(screen.getByRole("region", { name: "오라클 · 예시 결과" })).toBeVisible()
    expect(screen.getByText("출처 · 예시 데이터")).toBeVisible()
  })
  it("places safety notice immediately after the header", () => {
    render(<TrainingHome model={BASE} safetyNotice={<div data-testid="safety">안전 안내</div>} />)
    expect(screen.getByRole("banner").nextElementSibling).toBe(screen.getByTestId("safety"))
  })
  it("keeps today's action before optional Oracle detail and recent journal", () => {
    render(<TrainingHome
      model={TRAINING}
      safetyNotice={<div data-testid="safety">안전 안내</div>}
      oraclePreview={<HomeOraclePreview kind="partial" question="최근 결과" answer="확인한 기록만 보여요." sourceLabel="출처 · 2026.09.28" onOpen={vi.fn()} />}
      recentJournal={<div data-testid="recent-journal">하루 기록 1개</div>}
    />)
    const safety = screen.getByTestId("safety")
    const preview = screen.getByText("내 오라클 살펴보기")
    const next = screen.getByRole("region", { name: "다음 훈련" })
    const today = screen.getByLabelText("오늘")
    const journal = screen.getByTestId("recent-journal")
    expect(safety.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(next.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(next.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(journal) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
  it("preserves the optional install suggestion and a stable focus return target", () => {
    render(<TrainingHome model={TRAINING} installSuggestion={<section data-testid="install">바로가기 추가</section>} />)
    expect(screen.getByTestId("install")).toBeVisible()
    expect(screen.getByRole("button", { name: "더보기" })).toHaveAttribute("data-install-shortcut-return", "home")
  })
  it("uses next-training callback first and preserves prescription metadata", () => {
    const next = vi.fn(); const plan = vi.fn()
    render(<TrainingHome model={TRAINING} onOpenNextTraining={next} onOpenPlan={plan} />)
    const card = screen.getByRole("button", { name: /^다음 훈련 ·/u })
    expect(card).toHaveTextContent(/전체 25–40min @ RPE 5–6/u); fireEvent.click(card)
    expect(next).toHaveBeenCalledOnce(); expect(plan).not.toHaveBeenCalled()
  })
  it("does not claim all training is complete when today has a record", () => {
    render(<TrainingHome model={{ ...TRAINING, todayRecordCount: 1, briefing: "오늘 기록 · 수면 7h" }} />)
    expect(screen.getByText("오늘 기록을 남겼어요.")).toBeVisible(); expect(screen.getByText("다음 훈련")).toBeVisible(); expect(screen.queryByText(/모든 훈련을 마쳤어요/u)).toBeNull()
  })
})
