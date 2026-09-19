import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"

const appCss = readFileSync("src/styles/app.css", "utf8")

const WELCOME_MODEL = {
  homeMode: "WELCOME",
  todayMessage: "아직 오늘 기록이 없어요.",
  todayRecordCount: 0,
  journalSummary: "아직 기록이 없어요",
  flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택",
  planSummary: "저장된 계획 없음 · 계획안 만들기",
  analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요",
  showMinjiPrompt: true,
  nextTraining: null,
  briefing: "",
} satisfies TrainingHomeViewModel

const JOURNAL_MODEL = {
  ...WELCOME_MODEL,
  homeMode: "JOURNAL",
  todayMessage: "오늘 기록을 남겼어요.",
  todayRecordCount: 1,
  journalSummary: "1일 · 1개의 기록",
} satisfies TrainingHomeViewModel

const TRAINING_MODEL = {
  ...WELCOME_MODEL,
  homeMode: "TRAINING",
  planSummary: "저장된 계획 · 2개 일정",
  nextTraining: {
    date: "2026-08-20",
    laterSameDaySession: null,
    session: {
      day: 2,
      slot: "PM",
      role: "QUALITY",
      plannedEnergyIntent: "LT_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 5, maximum: 6 },
        durationMinutes: { minimum: 25, maximum: 40 },
      },
    },
  },
} satisfies TrainingHomeViewModel

afterEach(cleanup)

describe("training home modes", () => {
  it("marks the welcome title for Korean word-preserving wrapping", () => {
    render(<TrainingHome model={WELCOME_MODEL} />)

    const title = screen.getByRole("heading", {
      name: "오늘 운동을 기록해요",
    })
    const titleRule = appCss.match(/\.training-home__welcome-title\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(title).toHaveClass("training-home__welcome-title")
    expect(titleRule).toContain("word-break: keep-all")
    expect(titleRule).toContain("overflow-wrap: break-word")
  })

  it("keeps briefing and home metadata on Korean word boundaries", () => {
    const rules = [
      appCss.match(/\.training-home__briefing\s*\{[^}]*\}/u)?.[0] ?? "",
      appCss.match(/\.training-home__next-button small\s*\{[^}]*\}/u)?.[0] ?? "",
      appCss.match(/\.training-home__service small\s*\{[^}]*\}/u)?.[0] ?? "",
    ]
    const anywhereSelectors = [...appCss.matchAll(/([^{}]+)\{[^}]*overflow-wrap:\s*anywhere;?[^}]*\}/gu)]
      .map(([, selectors]) => selectors)

    expect(rules).not.toContain("")
    for (const rule of rules) {
      expect(rule).toContain("word-break: keep-all")
      expect(rule).toContain("overflow-wrap: break-word")
      expect(rule).not.toContain("overflow-wrap: anywhere")
    }

    expect(anywhereSelectors.join("\n")).not.toMatch(/\.training-home__(?:briefing|next-button small|service small)/u)
  })

  it("offers four direct purpose routes without a purpose questionnaire", () => {
    const onOpenTrends = vi.fn()
    const onOpenPlan = vi.fn()
    const onOpenGuide = vi.fn()
    const onOpenContent = vi.fn()
    render(<TrainingHome model={WELCOME_MODEL} {...{ onOpenTrends, onOpenPlan, onOpenGuide, onOpenContent }} />)

    const routes = within(screen.getByRole("navigation", { name: "바로 시작하기" }))
    expect(routes.getAllByRole("button")).toHaveLength(4)
    for (const [label, callback] of [
      ["내 훈련 분석", onOpenTrends], ["훈련 계획 만들기", onOpenPlan],
      ["예시 훈련 보기", onOpenGuide], ["훈련 방법 배우기", onOpenContent],
    ] as const) {
      fireEvent.click(routes.getByRole("button", { name: label }))
      expect(callback).toHaveBeenCalledTimes(1)
    }
    expect(screen.queryByText("모든 데이터는 이 기기에만 저장돼요.")).toBeNull()
  })

  it("keeps every welcome lead surface together without forcing viewport-height blank space", () => {
    const { container } = render(<TrainingHome model={WELCOME_MODEL} />)

    const fold = container.querySelector(".training-home__welcome-fold")
    const foldRule = appCss.match(/\.training-home__welcome-fold\s*\{[^}]*\}/u)?.[0] ?? ""
    const exampleRule = appCss.match(/\.training-home__welcome-fold \.training-home__example--welcome\s*\{[^}]*\}/u)?.[0] ?? ""
    const services = screen.getByRole("navigation", { name: "바로 시작하기" })
    const guide = screen.getByRole("button", { name: "민지의 예시 일지 보기" })

    expect(fold).toBeInstanceOf(HTMLElement)
    if (!(fold instanceof HTMLElement)) return

    expect(fold).toContainElement(screen.getByRole("banner"))
    expect(fold).toContainElement(screen.getByRole("heading", {
      name: "오늘 운동을 기록해요",
    }))
    expect(fold).toContainElement(screen.getByRole("button", { name: "오늘 기록 남기기" }))
    expect(fold).toContainElement(screen.getByRole("button", { name: "훈련 계획 만들기" }))
    expect(fold).toContainElement(guide)
    expect(fold).toContainElement(services)
    expect(foldRule).toContain("min-block-size: 0")
    expect(foldRule).not.toContain("100dvh")
    expect(exampleRule).toContain("margin-block-start: 0")
    expect(exampleRule).not.toContain("margin-block-start: auto")

    const preview = guide.querySelector(".training-home__example-preview")
    expect(preview).toHaveTextContent("첫날")
    expect(preview).toHaveTextContent("4.6km를 달린 첫 기록")
    expect(preview).toHaveTextContent("거리 4.6km · 시간 30분")
    expect(preview?.querySelector("[id]")).toBeNull()
    expect(preview?.querySelector("button, a, input, select, textarea")).toBeNull()
  })

  it("places the unchanged next-training section before today in training mode", () => {
    const { container } = render(
      <TrainingHome
        model={TRAINING_MODEL}
        todayContext={<div>오늘 상태</div>}
        recentJournal={recentJournal()}
      />,
    )

    const contentSections = [...container.querySelectorAll("section:not(.training-home__intro)")]

    expect(contentSections[0]).toHaveClass("training-home__next")
    expect(contentSections[1]).toHaveClass("training-home__today")
    expect(contentSections[2]).toHaveClass("training-home__recent")
    const nextTraining = screen.getByRole("button", { name: /^다음 훈련 ·/u })
    expect(nextTraining).toBeVisible()
    expect(nextTraining).toHaveAccessibleName(/조금 힘들게 꾸준히 · LT 훈련.*8월 20일.*오후.*총 25~40분.*RPE 5~6/u)
    expect(nextTraining).toHaveTextContent("조금 힘들게 꾸준히 · LT 훈련")
    expect(nextTraining).toHaveTextContent(/8월 20일.*오후.*총 25~40분.*RPE 5~6/u)
  })

  it("preserves intro, today, recent journal, and services order in journal mode", () => {
    render(
      <TrainingHome
        model={JOURNAL_MODEL}
        todayContext={<div>오늘 상태</div>}
        recentJournal={recentJournal()}
      />,
    )

    const intro = screen.getByRole("region", { name: "내 기록" })
    const today = screen.getByLabelText("오늘")
    const recent = screen.getByRole("region", { name: "최근 기록" })
    const services = screen.getByRole("navigation", { name: "내 기록 살펴보기" })

    expect(intro.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(recent.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(screen.getByText("오늘 기록을 남겼어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "오늘 기록하기" })).toBeNull()
    expect(screen.queryByRole("button", { name: "하루 마무리 기록하기" })).toBeNull()
    expect(screen.queryByText("오늘 상태")).toBeNull()
    expect(screen.queryByText("다음 훈련")).toBeNull()
  })

  it.each([
    { label: "JOURNAL", model: JOURNAL_MODEL },
    { label: "TRAINING", model: TRAINING_MODEL },
  ])("does not render a false briefing in $label mode", ({ model }) => {
    render(<TrainingHome model={model} />)

    expect(screen.queryByLabelText("아침 브리핑")).toBeNull()
  })

  it("recomposes welcome as journal after the first-record model rerender", () => {
    const view = render(
      <TrainingHome
        model={WELCOME_MODEL}
        todayContext={<div>숨겨질 오늘 상태</div>}
        recentJournal={recentJournal()}
      />,
    )

    expect(screen.getByRole("heading", {
      name: "오늘 운동을 기록해요",
    })).toBeVisible()
    expect(screen.queryByLabelText("오늘")).toBeNull()

    view.rerender(
      <TrainingHome
        model={JOURNAL_MODEL}
        todayContext={<div>오늘 상태</div>}
        recentJournal={recentJournal()}
      />,
    )

    expect(screen.getByRole("heading", { name: "내 기록" })).toBeVisible()
    expect(screen.queryByText("오늘 운동을 기록해요")).toBeNull()
    expect(screen.getByLabelText("오늘")).toBeVisible()
    expect(screen.getByRole("region", { name: "최근 기록" })).toBeVisible()
  })
})

function recentJournal() {
  return (
    <section className="training-home__recent" aria-label="최근 기록">
      <p>최근 일지 한 건</p>
    </section>
  )
}
