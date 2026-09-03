import type { ComponentProps } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { PaceRecommendation } from "./PaceRecommendation"

type Input = ComponentProps<typeof PaceRecommendation>["prescription"]
function fixture(performanceSeconds = 1111): Input {
  return {
    selectedAnchor: {
      anchorId: "synthetic-record", kind: "RECENT_RESULT", purpose: "CURRENT_CAPABILITY",
      eventDistanceM: 5000, performanceSeconds, achievedAt: "2026-09-01", seasonId: null,
      enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", freshnessState: "CURRENT",
      sourceRef: "athlete-record:synthetic-record", elapsedLabel: "2일 전",
    },
    repetitionDistanceM: 1000, targetRepSeconds: performanceSeconds / 5,
    templateId: "V2-SEED-05", templateVersion: "1.0.0", displayRoundingPolicyVersion: "seconds-v1",
  }
}
afterEach(cleanup)

describe("visible record-based pace recommendation", () => {
  it("keeps the entry and limitation visible without opening technical details", () => {
    const { container } = render(<PaceRecommendation prescription={fixture()} />)
    expect(screen.getByText("추천 기준")).toBeVisible()
    expect(screen.getByText("개인 기록 기반")).toBeVisible()
    expect(screen.getByText(/오늘 컨디션·날씨에 따라 조절/u)).toBeVisible()
    expect(container.querySelector("details")).not.toHaveAttribute("open")
  })

  it("shows the actual fractional calculation, input date and fixed-recovery limitation", async () => {
    const input = fixture()
    const before = JSON.stringify(input)
    render(<PaceRecommendation prescription={input} />)
    await userEvent.click(screen.getByText("추천 기준"))
    expect(screen.getByText(/최근 경기 · 5000m 18분 31초 · 2026-09-01/u)).toBeVisible()
    expect(screen.getByText(/직접 입력한 기록/u)).toBeVisible()
    expect(screen.getByText("1,111초 × 1000m ÷ 5000m")).toBeVisible()
    expect(screen.getByText(/계산값 약 222.2초 · 화면은 1초 단위로 반올림/u)).toBeVisible()
    expect(screen.getByText(/1000m당 약 3분 42초/u)).toBeVisible()
    expect(screen.getByText(/휴식은 개인 기록에서 계산한 시간이 아니라/u)).toBeVisible()
    expect(screen.getByText(/평균 속도를 반복 거리에 적용/u)).toBeVisible()
    expect(screen.getByText(/훈련 구성 V2-SEED-05 v1.0.0/u)).toBeVisible()
    expect(JSON.stringify(input)).toBe(before)
  })

  it("refreshes the explanation from changed record, repeat distance and template", async () => {
    const input = fixture()
    const { rerender } = render(<PaceRecommendation prescription={input} />)
    await userEvent.click(screen.getByText("추천 기준"))
    rerender(<PaceRecommendation prescription={{
      ...input, selectedAnchor: { ...input.selectedAnchor, eventDistanceM: 800, performanceSeconds: 121.5 },
      repetitionDistanceM: 200, targetRepSeconds: 30.375, templateId: "MD-800-01", templateVersion: "1.0.0",
    }} />)
    expect(screen.getByText("121.5초 × 200m ÷ 800m")).toBeVisible()
    expect(screen.getByText(/200m당 약 30초/u)).toBeVisible()
    expect(screen.getByText(/계산값 약 30.375초/u)).toBeVisible()
    expect(screen.queryByText(/222.2초|V2-SEED-05/u)).toBeNull()
    expect(screen.getByText(/MD-800-01 v1.0.0/u)).toBeVisible()
  })

  it("labels SB and verification honestly and never exposes raw identifiers", async () => {
    const input = fixture(1140)
    render(<PaceRecommendation prescription={{ ...input, selectedAnchor: {
      ...input.selectedAnchor, kind: "SB", purpose: "SEASON_CONTEXT", seasonId: "2026",
      verificationState: "UNVERIFIED", sourceRef: "PRIVATE_SOURCE_SENTINEL", anchorId: "PRIVATE_ID_SENTINEL",
    } }} />)
    await userEvent.click(screen.getByText("추천 기준"))
    expect(screen.getByText(/시즌 최고 · 5000m 19분/u)).toBeVisible()
    expect(screen.getByText(/검증되지 않은 기록/u)).toBeVisible()
    expect(document.body).not.toHaveTextContent(/PRIVATE_SOURCE_SENTINEL|PRIVATE_ID_SENTINEL/u)
    expect(document.querySelector("a[href]")).toBeNull()
  })
})
