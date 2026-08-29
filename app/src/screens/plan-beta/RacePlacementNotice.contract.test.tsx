import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { RacePlacementState } from "@impl/plan-generator/race-placement"
import { RacePlacementNotice } from "./RacePlacementNotice"

afterEach(cleanup)

const states: readonly {
  readonly state: RacePlacementState
  readonly title: string
}[] = [
  {
    state: { kind: "NO_TARGET_RACE", reasonCode: "NO_TARGET_RACE_REQUESTED", numericTaperAuthority: "NOT_GRANTED" },
    title: "경기 날짜 없이 만든 일반 계획",
  },
  {
    state: {
      kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
      reasonCode: "RACE_DATE_RETENTION_NOT_AUTHORIZED",
      eventDistanceM: 1500,
      projectionH: 9,
      targetRaceDate: "2099-08-23",
      placementFallback: "GENERIC_PLACEMENT_NO_AUTHORITY",
      placementReasonCode: "NO_ACTIVE_RACE_PLACEMENT_ROWS",
      numericTaperAuthority: "NOT_GRANTED",
    },
    title: "경기 날짜는 미리보기만 가능",
  },
  {
    state: {
      kind: "TARGET_RACE_STORED_FOR_LATER",
      reasonCode: "TARGET_OUTSIDE_VISIBLE_PROJECTION",
      eventDistanceM: 1500,
      projectionH: 9,
      targetRaceDate: "2099-08-23",
      numericTaperAuthority: "NOT_GRANTED",
    },
    title: "경기 날짜만 나중을 위해 보관",
  },
  {
    state: {
      kind: "RACE_PLACEMENT_ONLY",
      reasonCode: "EXACT_PLACEMENT_AUTHORITY_APPLIED",
      eventDistanceM: 1500,
      projectionH: 9,
      targetRaceDate: "2099-08-23",
      authorityRowId: "fixture-row",
      numericTaperAuthority: "NOT_GRANTED",
    },
    title: "현재 제공 기준으로 날짜 배치만 적용",
  },
  {
    state: {
      kind: "GENERIC_PLACEMENT_NO_AUTHORITY",
      reasonCode: "NO_EXACT_EVENT_PROJECTION_ROW",
      eventDistanceM: 1500,
      projectionH: 9,
      targetRaceDate: "2099-08-23",
      numericTaperAuthority: "NOT_GRANTED",
    },
    title: "적용 가능한 경기 배치 기준 없음",
  },
]

describe("race placement status vocabulary", () => {
  it.each(states)("renders $state.kind without claiming dose changes", ({ state, title }) => {
    const { container } = render(<RacePlacementNotice state={state} />)
    expect(screen.getByText(title)).toBeVisible()
    expect(container).not.toHaveTextContent("테이퍼")
    expect(container).not.toHaveTextContent(/자동.*강도/u)
  })
})
