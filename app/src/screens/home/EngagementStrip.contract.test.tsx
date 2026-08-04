import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { EngagementSummary } from "../../domain/engagement"
import { EngagementStrip } from "./EngagementStrip"

afterEach(cleanup)

const summary = (patch: Partial<EngagementSummary>): EngagementSummary => ({
  points: 0,
  recordingStreak: 0,
  journalDays: 0,
  pointMeaning: "NON_ECONOMIC_LOCAL_BETA",
  ...patch,
})

describe("engagement copy", () => {
  it("names earned points honestly and avoids shame after a missed day", () => {
    render(<EngagementStrip summary={summary({ points: 8, journalDays: 2 })} />)

    expect(screen.getByText("누적 획득 · BETA")).toBeVisible()
    expect(screen.getByText(/연속 기록은 쉬어가도/u)).toBeVisible()
    expect(screen.queryByText(/시들/u)).toBeNull()
    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
  })
})

describe("engagement empty state", () => {
  /*
   * ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT §17 L546-557:
   * "Empty and error states should be useful and honest. They must not be styled as success."
   * 0P / 0일 / 0일 을 성취 점수판 레이아웃에 채워넣는 것은 성취 UI 를 빌린 것이므로 금지.
   */
  it("does not render a zero scoreboard before any journal exists", () => {
    render(<EngagementStrip summary={summary({})} />)

    expect(screen.queryByText("누적 획득 · BETA")).toBeNull()
    expect(screen.queryByText("기록 연속")).toBeNull()
    expect(screen.queryByText("함께한 날")).toBeNull()
    expect(screen.queryByText("0P")).toBeNull()
    expect(screen.queryAllByText("0일")).toHaveLength(0)
  })

  it("keeps the point rule visible so the empty state still teaches", () => {
    render(<EngagementStrip summary={summary({})} />)

    expect(screen.getByLabelText("기록 습관")).toBeVisible()
    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
    expect(screen.getByText(/거리·속도·훈련 완료에는 점수를 주지 않아요/u)).toBeVisible()
  })

  /*
   * JOURNAL_DELIGHT_AND_DECORATION_SPEC L445 / L460 `missed_day_shame_copy: forbidden`.
   * 빈 상태를 줄이는 과정에서 재촉·부끄러움 문구가 새로 들어오면 안 된다.
   */
  it("adds no nagging or shame copy to the empty state", () => {
    render(<EngagementStrip summary={summary({})} />)

    expect(screen.queryByText(/아직/u)).toBeNull()
    expect(screen.queryByText(/시작해\s*보|시작하세요/u)).toBeNull()
    expect(screen.queryByText(/놓친|빠뜨|게을|분발|힘내/u)).toBeNull()
  })

  it("hides the decoration shop until at least one point is earned", () => {
    render(<EngagementStrip summary={summary({})} />)

    expect(screen.queryByText(/일지 꾸미기/u)).toBeNull()
    expect(screen.queryByRole("button", { name: "꾸미기 열기" })).toBeNull()
  })

  /*
   * 첫 기록 하나만 있어도 점수판은 즉시 정상 복귀해야 한다.
   * FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT §10 L222 descriptive_single_observation: allowed.
   */
  it("restores the full strip as soon as one journal day exists", () => {
    render(<EngagementStrip summary={summary({ points: 4, journalDays: 1, recordingStreak: 1 })} />)

    expect(screen.getByText("누적 획득 · BETA")).toBeVisible()
    expect(screen.getByText("4P")).toBeVisible()
    expect(screen.getByRole("button", { name: "꾸미기 열기" })).toBeVisible()
  })
})
