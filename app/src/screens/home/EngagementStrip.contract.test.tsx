import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import type { EngagementSummary } from "../../domain/engagement"
import { EngagementStrip } from "./EngagementStrip"

afterEach(cleanup)

const summary = (patch: Partial<EngagementSummary>): EngagementSummary => ({
  points: 0,
  journalDays: 0,
  visitDays: 0,
  visitedToday: false,
  journalRecordedToday: false,
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  ...patch,
})

describe("engagement copy", () => {
  it("shows participation, a gentle plant state, and points earned only by recording days", () => {
    render(<EngagementStrip summary={summary({ journalDays: 2, visitDays: 2, points: 10 })} savedCount={3} />)

    expect(screen.getByText(/이 기기에 3건 저장됨/u)).toBeVisible()
    expect(screen.getByText(/온라인 보관은 계정 연동 후/u)).toBeVisible()
    expect(screen.getByText("기록한 날")).toBeVisible()
    expect(screen.getByText("2일")).toBeVisible()
    expect(screen.getByText("사용 가능")).toBeVisible()
    expect(screen.getByText("10P")).toBeVisible()
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
    render(<EngagementStrip summary={summary({ journalDays: 1, points: 4 })} savedCount={1} />)

    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
    expect(screen.getByText(/기록한 날 4P/u)).toBeVisible()
    expect(screen.getByText(/거리·속도·훈련 강도에는 점수를 매기지 않아요/u)).toBeVisible()
  })
  it("offers one explicit daily visit point without pressuring the athlete", async () => {
    const user = userEvent.setup()
    let called = 0
    render(<EngagementStrip summary={summary({})} savedCount={0} onRecordVisit={() => { called += 1 }} />)

    await user.click(screen.getByRole("button", { name: "오늘 방문 확인 +1P" }))
    expect(called).toBe(1)
    expect(screen.queryByText(/연속|놓친|마감/u)).toBeNull()
  })

  it("explains a saved memo-only or partial entry without calling it the first record", () => {
    render(<EngagementStrip summary={summary({})} savedCount={1} />)

    expect(screen.getByText(/기록은 이 기기에 저장됐어요/u)).toBeVisible()
    expect(screen.getByText(/메모 내용은 포인트 판단에 사용하지 않아요/u)).toBeVisible()
    expect(screen.queryByText(/첫 기록을 남기면/u)).toBeNull()
  })

  it("explains why earned journal points remain after every source journal is deleted", () => {
    render(<EngagementStrip summary={summary({ journalDays: 1, points: 4 })} savedCount={0} />)

    expect(screen.getByText(/일지를 삭제해도.*포인트는 그대로 유지돼요/u)).toBeVisible()
  })

  it("separates available, earned, and spent points after a decoration purchase", () => {
    render(
      <EngagementStrip
        summary={summary({ journalDays: 5, points: 20 })}
        savedCount={5}
        availablePoints={12}
        spentPoints={8}
      />,
    )

    expect(screen.getByText("사용 가능")).toBeVisible()
    expect(screen.getByText("12P")).toBeVisible()
    expect(screen.getByText(/누적 20P.*사용 8P/u)).toBeVisible()
  })

  it("shows the nearest decoration target before the user attempts a purchase", () => {
    render(
      <EngagementStrip
        summary={summary({ journalDays: 1, points: 5 })}
        savedCount={1}
        availablePoints={5}
        spentPoints={0}
        nextReward={{ name: "결승선 스티커", cost: 8, remainingPoints: 3 }}
      />,
    )

    expect(screen.getByText("결승선 스티커")).toBeVisible()
    expect(screen.getByText("3P 더 모으면 받을 수 있어요")).toBeVisible()
    expect(screen.getByRole("progressbar", { name: "결승선 스티커 포인트 진행" })).toHaveAttribute("value", "5")
  })

  it("shows cumulative badges and lets the user explicitly share derived progress", async () => {
    const user = userEvent.setup()
    let shared = 0
    render(
      <EngagementStrip
        summary={summary({ journalDays: 14, points: 56 })}
        savedCount={14}
        availablePoints={48}
        spentPoints={8}
        onShare={() => { shared += 1 }}
      />,
    )

    expect(screen.getByText("기록한 날 14일")).toBeVisible()
    expect(screen.getByText(/다음 배지까지 기록한 날 16일/u)).toBeVisible()
    expect(screen.getByText("기록한 날·정원·배지·꾸미기·사용 가능 포인트만 공유해요.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "정원과 배지 공유" }))
    expect(shared).toBe(1)
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

  it("keeps cumulative plant growth without a wilted missed-day state", () => {
    render(<EngagementStrip summary={summary({ journalDays: 14, points: 56 })} savedCount={4} />)

    expect(screen.getByLabelText("식물 상태: 작은 나무로 자랐어요")).toBeVisible()
    expect(screen.queryByText(/쉬는 중|시들/u)).toBeNull()
    expect(screen.queryByText(/놓친|빠뜨|게을|분발|힘내/u)).toBeNull()
  })
})
