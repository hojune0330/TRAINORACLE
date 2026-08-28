import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { EnergySystemLedgerPanel } from "./EnergySystemLedgerPanel"

afterEach(cleanup)

function observation(): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId: "explicit-lt",
      sourceVersion: null,
      observedAt: "2026-08-20T08:00:00.000Z",
      trustState: "ACCEPTED",
      containsPrivateRawText: false,
    },
    loggedOn: "2026-08-20",
    energySystem: "LT",
    distanceKm: 8,
    durationMin: 40,
    secondsPerKm: 300,
    rpe: 6,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      system: "EXPLICIT",
      distanceKm: "EXPLICIT",
      durationMin: "EXPLICIT",
      secondsPerKm: "DERIVED",
      rpe: "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("energy system ledger UI", () => {
  it("shows every system, honest metrics, mixed-unallocated, and an accessible table", async () => {
    const user = userEvent.setup()
    render(<EnergySystemLedgerPanel
      observations={[observation()]}
      today="2026-08-28"
      planState={stateFixture()}
      mode="full"
    />)

    const region = screen.getByRole("region", { name: "에너지 시스템 누적" })
    expect(within(region).getByRole("img", { name: /LT 지속 페이스 1회/u })).toBeVisible()
    expect(within(region).getByText("40분 · 8km · RPE 6")).toBeVisible()
    expect(within(region).getByRole("img", { name: /MIX 복합·미배분 0회/u })).toBeVisible()
    expect(within(region).getByRole("table", { name: "에너지 시스템별 일지 누적" })).toBeInTheDocument()
    expect(within(region).getByText(/예정 1회 · 완료 표시 0회/u)).toBeVisible()

    await user.click(within(region).getByRole("button", { name: "8주" }))
    expect(within(region).getByRole("button", { name: "8주" })).toHaveAttribute("aria-pressed", "true")
  })

  it("does not draw seven zeros when no direct system selection exists", () => {
    render(<EnergySystemLedgerPanel
      observations={[]}
      today="2026-08-28"
      planState={null}
      mode="full"
    />)

    expect(screen.getAllByText("—")).toHaveLength(7)
    expect(screen.getAllByText(/직접 선택한 기록 없음/u)).toHaveLength(7)
    expect(screen.queryByText(/^0회$/u)).not.toBeInTheDocument()
  })

  it("keeps the compact home summary short while naming mixed allocation", () => {
    render(<EnergySystemLedgerPanel
      observations={[observation()]}
      today="2026-08-28"
      planState={stateFixture()}
      mode="compact"
    />)

    expect(screen.getByRole("region", { name: "에너지 시스템 요약" })).toBeVisible()
    expect(screen.getByText("MIX 복합·미배분 0회")).toBeVisible()
    expect(screen.getByText(/현재 계획 예정 1회 · 완료 표시 0회/u)).toBeVisible()
  })

  it("does not present a compact mixed zero when no system source exists", () => {
    render(<EnergySystemLedgerPanel
      observations={[]}
      today="2026-08-28"
      planState={null}
      mode="compact"
    />)

    expect(screen.getByText("MIX 복합·미배분 —")).toBeVisible()
    expect(screen.queryByText("MIX 복합·미배분 0회")).not.toBeInTheDocument()
  })
})
