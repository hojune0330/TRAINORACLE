import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { MainWorkComparison } from "./MainWorkComparison"
import type { MainComparisonRow, MainPrescriptionView } from "../../domain/plan-main-comparison"

afterEach(cleanup)

const view: MainPrescriptionView = {
  kind: "PACE_TARGET", work: "1세트 × (10회 × 200m) · 총 10회", recovery: "반복 사이 60초 서서 쉬기 · 총 9번",
  intensity: "800m 기록 기준 · 200m마다 목표 30.5초", time: "전체 수행시간 미산정", limitation: "효과나 부담이 같다는 뜻은 아니에요.",
}
const row: MainComparisonRow = { key: "2:PM", day: 2, slot: "PM", a: view, b: view, samePrescribedValues: true, methodRelation: "SAME", methodDifferences: [] }
const comparison = { contextMatches: true, easyDurationOnly: true, sameMainValues: true, sameMainPrescription: true, hasDetailed: true, hasUnspecified: false, rows: [row] }

describe("MAIN comparison presentation", () => {
  it("names structural differences without claiming a reviewed alternative", async () => {
    const user = userEvent.setup()
    render(<MainWorkComparison comparison={{ ...comparison, rows: [{ ...row, samePrescribedValues: false,
      methodRelation: "DIFFERENT_REQUIRES_REVIEW", methodDifferences: ["WORK_UNIT", "RECOVERY", "TERMINAL_RECOVERY"],
    }] }} />)
    await user.click(screen.getByText("본운동 방법 비교"))
    expect(screen.getByText("다른 부분: 한 번에 달리는 거리·시간 · 반복·세트·구간 사이 회복 · 마지막 본운동 뒤 회복")).toBeVisible()
    expect(screen.getByText(/두 방법의 적용 범위와 차이를 검토해야/u)).toBeVisible()
  })

  it("starts compact and expands actual shared work once", async () => {
    const user = userEvent.setup()
    render(<MainWorkComparison comparison={comparison} />)
    expect(screen.getByText(view.work)).not.toBeVisible()
    await user.click(screen.getByText("본운동 방법 비교"))
    expect(screen.getByText(view.work)).toBeVisible()
    expect(screen.getAllByText(view.intensity)).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "2일차 · 오후" })).toBeVisible()
    expect(screen.getByText("본운동 방법과 목표값이 같아요. 다른 방법 두 개가 아니에요.")).toBeVisible()
    expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual(["운동 구간", "회복", "목표 강도", "시간 정보", "알 수 있는 것과 한계"])
  })

  it("shows A and B separately when dose differs but does not claim a second method", async () => {
    const user = userEvent.setup()
    render(<MainWorkComparison comparison={{ ...comparison, rows: [{ ...row, samePrescribedValues: false, b: { ...view, work: "1세트 × (11회 × 200m) · 총 11회" } }] }} />)
    await user.click(screen.getByText("본운동 방법 비교"))
    expect(screen.getByText("계획안 A")).toBeVisible()
    expect(screen.getByText("계획안 B")).toBeVisible()
    expect(screen.getByText(/같은 본운동 방법에서 횟수나 목표값이 달라요/u)).toBeVisible()
  })

  it("replaces stale content after new inputs and preserves the open drawer", async () => {
    const user = userEvent.setup()
    const rendered = render(<MainWorkComparison comparison={comparison} />)
    await user.click(screen.getByText("본운동 방법 비교"))
    const nextView = { ...view, intensity: "800m 기록 기준 · 200m마다 목표 30.875초" }
    rendered.rerender(<MainWorkComparison comparison={{ ...comparison, rows: [{ ...row, a: nextView, b: nextView }] }} />)
    expect(screen.queryByText(view.intensity)).not.toBeInTheDocument()
    expect(screen.getByText(nextView.intensity)).toBeVisible()
  })

  it("missing matched work is not displayed as zero or as the other candidate's work", async () => {
    const user = userEvent.setup()
    render(<MainWorkComparison comparison={{ ...comparison, rows: [{ ...row, b: null, samePrescribedValues: false, methodRelation: "CONTEXT_MISMATCH" }] }} />)
    await user.click(screen.getByText("본운동 방법 비교"))
    expect(screen.getByText("대응하는 본운동이 없거나 구성을 읽을 수 없어요.")).toBeVisible()
    expect(screen.getAllByText(view.work)).toHaveLength(1)
    expect(screen.getByText("같은 일정·목적의 구간으로 비교할 수 없어요.")).toBeVisible()
  })

  it("does not erase existing intervals when only one side is RPE-only", async () => {
    const user = userEvent.setup()
    render(<MainWorkComparison comparison={{ ...comparison, rows: [{ ...row, samePrescribedValues: false, methodRelation: "UNSPECIFIED", b: { ...view, kind: "RPE_TIME_RANGE", work: "구간 미지정", intensity: "RPE 7~8" } }] }} />)
    await user.click(screen.getByText("본운동 방법 비교"))
    expect(screen.getByText("한쪽만 구간별 상세 처방이 있어 두 본운동 방법을 비교할 수 없어요.")).toBeVisible()
    expect(screen.getByText(view.work)).toBeVisible()
    expect(screen.getByText("RPE 7~8")).toBeVisible()
    expect(screen.queryByText(/반복과 회복이 없으면/u)).not.toBeInTheDocument()
  })
})
