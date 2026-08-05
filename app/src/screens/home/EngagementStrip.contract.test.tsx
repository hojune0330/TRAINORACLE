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
  /*
   * WORK_ORDER_UX2 §2-2: 포인트/불꽃/스트릭 지표를 제거하고 "기록 보존" 정보로 교체.
   * PHILOSOPHY §9-9 가 점수·스트릭·불꽃 게이미피케이션을 금지한다.
   */
  it("tells how many entries are kept on this device without scoring", () => {
    render(<EngagementStrip summary={summary({ journalDays: 2 })} savedCount={3} />)

    expect(screen.getByText(/이 기기에 3건 저장됨/u)).toBeVisible()
    expect(screen.getByText(/온라인 보관은 계정 연동 후/u)).toBeVisible()
    expect(screen.queryByText(/누적 획득/u)).toBeNull()
    expect(screen.queryByText(/기록 연속/u)).toBeNull()
    expect(screen.queryByText(/함께한 날/u)).toBeNull()
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

  it("keeps the no-points rule visible", () => {
    render(<EngagementStrip summary={summary({ journalDays: 1 })} savedCount={1} />)

    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
    expect(screen.getByText(/거리·속도·훈련 완료에는 점수를 매기지 않아요/u)).toBeVisible()
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

  it("keeps the rule visible so the empty state still teaches", () => {
    render(<EngagementStrip summary={summary({})} savedCount={0} />)

    expect(screen.getByLabelText("기록 습관")).toBeVisible()
    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
    expect(screen.getByText(/거리·속도·훈련 완료에는 점수를 매기지 않아요/u)).toBeVisible()
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

  /*
   * WORK_ORDER_UX2 §2-2: 꾸미기 상점 진입점은 홈에서 제거(리디자인은 후속 작업 분리).
   * 컴포넌트 파일은 존치(NORTH_STAR "지우지 마라")하되 홈에서 버튼을 노출하지 않는다.
   */
  it("has no decoration shop entry from home", () => {
    render(<EngagementStrip summary={summary({ journalDays: 1 })} savedCount={1} />)

    expect(screen.queryByText(/일지 꾸미기/u)).toBeNull()
    expect(screen.queryByRole("button", { name: "꾸미기 열기" })).toBeNull()
  })
})
