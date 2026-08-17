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

describe("explicit pace evidence selection", () => {
  it("does not auto-select even one stored result", () => {
    render(<PaceEvidenceFlow
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
})
