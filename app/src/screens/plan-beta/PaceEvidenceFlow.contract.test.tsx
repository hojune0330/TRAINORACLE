import React from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AthleteRecord } from "../../domain/athlete-records"
import { PaceEvidenceFlow } from "./PaceEvidenceFlow"

afterEach(cleanup)

const RECORDS: readonly AthleteRecord[] = [
  {
    schemaVersion: 1,
    id: "pb-5000-1110",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-05-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5000-1110",
    savedAt: "2026-05-10T00:00:00.000Z",
  },
  {
    schemaVersion: 1,
    id: "sb-5000-1140",
    purpose: "SEASON_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1140,
    achievedOn: "2026-04-20",
    seasonId: "2026",
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:sb-5000-1140",
    savedAt: "2026-04-20T00:00:00.000Z",
  },
]

function ControlledFlow({ onConfirm }: { readonly onConfirm: () => void }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [comparison, setComparison] = React.useState<string | null>(null)
  return (
    <PaceEvidenceFlow
      eventGroup="FIVE_K"
      records={RECORDS}
      selectedRecordId={selected}
      comparisonRecordId={comparison}
      binding={{ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" }}
      onSelectRecord={setSelected}
      onCompareRecord={setComparison}
      onConfirm={onConfirm}
    />
  )
}

function ConfirmingFlow() {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [binding, setBinding] = React.useState<
    | { readonly kind: "fallback"; readonly code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" }
    | { readonly kind: "bound"; readonly code: "PACE_TARGET_BOUND" }
  >({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" })
  return (
    <PaceEvidenceFlow
      eventGroup="FIVE_K"
      records={RECORDS}
      selectedRecordId={selected}
      comparisonRecordId={null}
      binding={binding}
      onSelectRecord={setSelected}
      onCompareRecord={() => undefined}
      onConfirm={() => setBinding({ kind: "bound", code: "PACE_TARGET_BOUND" })}
    />
  )
}

describe("explicit pace evidence selection", () => {
  it("does not auto-select even one stored result", () => {
    render(<PaceEvidenceFlow
      eventGroup="FIVE_K"
      records={RECORDS.slice(0, 1)}
      selectedRecordId={null}
      comparisonRecordId={null}
      binding={{ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" }}
      onSelectRecord={() => undefined}
      onCompareRecord={() => undefined}
      onConfirm={() => undefined}
    />)

    expect(screen.getByRole("button", { name: /개인 최고.*18분 30초/u })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "이 기록으로 개인 페이스 적용" })).toBeNull()
  })

  it("keeps comparison separate and confirms only the selected record", async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ControlledFlow onConfirm={onConfirm} />)
    const flow = screen.getByRole("region", { name: "개인 페이스 기준 기록" })

    await user.click(within(flow).getByRole("button", { name: /개인 최고.*18분 30초/u }))
    await user.click(within(flow).getByText("다른 같은 종목 기록과 비교"))
    await user.click(within(flow).getByRole("button", { name: /비교 기록.*시즌 최고.*19분/u }))

    expect(within(flow).getByText(/기준 기록.*18분 30초/u)).toBeVisible()
    expect(within(flow).getByText(/비교만.*19분/u)).toBeVisible()
    await user.click(within(flow).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("moves focus to the application result after confirmation", async () => {
    const user = userEvent.setup()
    render(<ConfirmingFlow />)
    const flow = screen.getByRole("region", { name: "개인 페이스 기준 기록" })

    await user.click(within(flow).getByRole("button", { name: /개인 최고.*18분 30초/u }))
    await user.click(within(flow).getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))

    const status = within(flow).getByRole("status")
    expect(status).toHaveTextContent("선택한 기록으로 두 후보에 같은 상세 처방을 적용했어요.")
    expect(status).toHaveFocus()
  })

  it("identifies an internal binding failure without blaming the athlete's record", () => {
    render(<PaceEvidenceFlow
      eventGroup="FIVE_K"
      records={RECORDS}
      selectedRecordId={RECORDS[0]?.id ?? null}
      comparisonRecordId={null}
      binding={{ kind: "fallback", code: "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT" }}
      onSelectRecord={() => undefined}
      onCompareRecord={() => undefined}
      onConfirm={() => undefined}
    />)

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("선택한 기록에는 문제가 없어요")
    expect(status).toHaveTextContent("상세 처방을 연결하는 중 문제가 생겨")
    expect(status).not.toHaveTextContent("현재 승인 범위")
  })
})
