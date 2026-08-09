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
  it("shows participation, a gentle plant state, and points earned only by recording days", () => {
    render(<EngagementStrip summary={summary({ journalDays: 2, recordingStreak: 2, points: 8 })} savedCount={3} />)

    expect(screen.getByText(/이 기기에 3건 저장됨/u)).toBeVisible()
    expect(screen.getByText(/온라인 보관은 계정 연동 후/u)).toBeVisible()
    expect(screen.getByText("함께한 날")).toBeVisible()
    expect(screen.getByText("2일")).toBeVisible()
    expect(screen.getByText("기록 연속")).toBeVisible()
    expect(screen.getByText("2일 · 8P")).toBeVisible()
    expect(screen.getByLabelText("식물 상태: 새싹이 자라고 있어요")).toBeVisible()
  })

  it("names the backup action so preservation is actionable", () => {
    render(
      <EngagementStrip
        summary={summary({ journalDays: 1 })}
        savedCount={1}
        onOpenMore={() => {}}
      />,
    )

    expect(screen.getByRole("button", { name: "백업 안내 보기" })).toBeVisible()
  })

  it("rewards a recorded day without tying points to distance, speed, or intensity", () => {
    render(<EngagementStrip summary={summary({ journalDays: 1, recordingStreak: 1, points: 4 })} savedCount={1} />)

    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
    expect(screen.getByText(/남긴 날마다 4P/u)).toBeVisible()
    expect(screen.getByText(/거리·속도·훈련 강도에는 점수를 매기지 않아요/u)).toBeVisible()
  })
})

describe("engagement empty state", () => {
  /*
   * ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT §17 L546-557:
   * "Empty and error states should be useful and honest. They must not be styled as success."
   * 0P / 0일 / 0일 을 성취 점수판 레이아웃에 채워넣는 것은 성취 UI 를 빌린 것이므로 금지.
   */
  it("does not render a preservation count before any journal exists", () => {
    render(<EngagementStrip summary={summary({})} savedCount={0} />)

    expect(screen.queryByText(/저장됨/u)).toBeNull()
    expect(screen.queryByText("0건")).toBeNull()
  })

  it("keeps a calm first-record explanation instead of a zero-value scoreboard", () => {
    render(<EngagementStrip summary={summary({})} savedCount={0} />)

    expect(screen.getByLabelText("기록 습관")).toBeVisible()
    expect(screen.getByText(/남긴 날마다 4P/u)).toBeVisible()
    expect(screen.getByText(/첫 기록을 남기면 일지를 꾸밀 수 있어요/u)).toBeVisible()
  })

  /*
   * JOURNAL_DELIGHT_AND_DECORATION_SPEC L445 / L460 `missed_day_shame_copy: forbidden`.
   * 빈 상태를 줄이는 과정에서 재촉·부끄러움 문구가 새로 들어오면 안 된다.
   */
  it("adds no nagging or shame copy to the empty state", () => {
    render(<EngagementStrip summary={summary({})} savedCount={0} />)

    expect(screen.queryByText(/아직/u)).toBeNull()
    expect(screen.queryByText(/시작해\s*보|시작하세요/u)).toBeNull()
    expect(screen.queryByText(/놓친|빠뜨|게을|분발|힘내/u)).toBeNull()
  })

  it("shows a wilted plant without blaming a returning user", () => {
    render(<EngagementStrip summary={summary({ journalDays: 4, points: 16 })} savedCount={4} />)

    expect(screen.getByLabelText("식물 상태: 천천히 다시 시작해요")).toBeVisible()
    expect(screen.queryByText(/놓친|빠뜨|게을|분발|힘내/u)).toBeNull()
  })
})
