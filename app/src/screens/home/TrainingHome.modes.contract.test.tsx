import { readFileSync } from "node:fs"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"

const appCss = readFileSync("src/styles/app.css", "utf8")

const WELCOME_MODEL = {
  homeMode: "WELCOME",
  todayMessage: "아직 오늘 기록이 없어요.",
  journalSummary: "아직 기록이 없어요",
  flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택",
  planSummary: "저장된 계획 없음 · 계획 후보 만들기",
  analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요",
  showMinjiPrompt: true,
  nextTraining: null,
  briefing: "",
} satisfies TrainingHomeViewModel

const JOURNAL_MODEL = {
  ...WELCOME_MODEL,
  homeMode: "JOURNAL",
  todayMessage: "오늘 1개의 기록이 있어요.",
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
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
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

  it("preserves the welcome heading name while grouping its semantic phrases", () => {
    render(<TrainingHome model={WELCOME_MODEL} />)

    const title = screen.getByRole("heading", {
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
    })
    const phraseRule = appCss.match(/\.training-home__welcome-title-phrase\s*\{[^}]*\}/u)?.[0] ?? ""
    const phraseTexts = [...title.querySelectorAll(".training-home__welcome-title-phrase")]
      .map((phrase) => phrase.textContent)

    expect(title).toHaveAccessibleName(
      "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
    )
    expect(phraseTexts).toEqual([
      "달리기 일지를",
      "남기고,",
      "내 기록으로",
      "훈련 계획을 받아요.",
    ])
    expect(phraseRule).toContain("white-space: nowrap")
  })

  it("groups every welcome lead surface in one token-sized visible fold before services", () => {
    const { container } = render(<TrainingHome model={WELCOME_MODEL} />)

    const fold = container.querySelector(".training-home__welcome-fold")
    const foldRule = appCss.match(/\.training-home__welcome-fold\s*\{[^}]*\}/u)?.[0] ?? ""
    const services = screen.getByRole("navigation", { name: "내 기록 살펴보기" })

    expect(fold).toBeInstanceOf(HTMLElement)
    if (!(fold instanceof HTMLElement)) return

    expect(fold).toContainElement(screen.getByRole("banner"))
    expect(fold).toContainElement(screen.getByRole("heading", {
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
    }))
    expect(fold).toContainElement(screen.getByRole("button", { name: "오늘 기록 남기기" }))
    expect(fold).toContainElement(screen.getByRole("button", { name: "훈련 계획 만들기" }))
    expect(fold).toContainElement(screen.getByRole("button", { name: "민지의 예시 일지 보기" }))
    expect(fold.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(foldRule).toContain(
      "min-block-size: calc(100dvh - var(--app-shell-tab-bar-height))",
    )
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
    expect(screen.getByRole("button", {
      name: /다음 훈련.*지속 페이스.*LT 훈련.*8월 20일.*오후.*총 25~40분.*RPE 5~6/u,
    })).toBeVisible()
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
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
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
    expect(screen.queryByText("달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.")).toBeNull()
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
