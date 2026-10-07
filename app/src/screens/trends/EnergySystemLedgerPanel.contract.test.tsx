import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { EnergySystemLedgerPanel } from "./EnergySystemLedgerPanel"
import { ENERGY_SYSTEM_KEYS } from "../../domain/energy-system-taxonomy"

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
  it("does not hide later categories in compact mode or repeat MIX", () => {
    const observations = ENERGY_SYSTEM_KEYS.map((key, index) => ({ ...observation(), energySystem: key, sourceRef: { ...observation().sourceRef, sourceId: String(index) } }))
    const { container } = render(<EnergySystemLedgerPanel observations={observations} today="2026-08-28" planState={null} mode="compact" />)
    expect(container.querySelectorAll(".energy-ledger__compact-row")).toHaveLength(6)
    expect(screen.getByText("ATP-PC")).toBeVisible()
    expect(screen.getAllByText("MIX 여러 강도 조합 1회")).toHaveLength(1)
  })
  it("uses exact proportional bar length for rare purposes", () => {
    const observations = Array.from({ length: 20 }, (_, index) => ({ ...observation(), sourceRef: { ...observation().sourceRef, sourceId: String(index) } }))
    observations.push({ ...observation(), energySystem: "ATP_PC", sourceRef: { ...observation().sourceRef, sourceId: "rare" } })
    const { container } = render(<EnergySystemLedgerPanel observations={observations} today="2026-08-28" planState={null} mode="full" />)
    expect(container.querySelector(".energy-ledger__row--atp-pc .energy-ledger__bar-fill")).toHaveStyle({ width: "5%" })
  })
  it("shows every system, honest metrics, mixed-unallocated, and an accessible table", async () => {
    const user = userEvent.setup()
    render(<EnergySystemLedgerPanel
      observations={[observation()]}
      today="2026-08-28"
      planState={stateFixture()}
      mode="full"
    />)

    const region = screen.getByRole("region", { name: "에너지 시스템 누적" })
    expect(within(region).getByRole("heading", { level: 2, name: /에너지 시스템 누적/u })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(region.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(within(region).getByRole("img", { name: /LT 지속 페이스 1회/u })).toBeVisible()
    expect(within(region).getByText("40분 (1회 기록) · 8km (1회 기록) · RPE 6 (1회 기록)")).toBeVisible()
    expect(within(region).getByRole("img", { name: /MIX 여러 강도 조합 0회/u })).toBeVisible()
    expect(within(region).getByRole("table", { name: "에너지 시스템별 일지 누적" })).toBeInTheDocument()
    expect(within(region).getByText(/예정 1회 · 완료 표시 0회/u)).toBeVisible()

    await user.click(within(region).getByRole("button", { name: "8주" }))
    expect(within(region).getByRole("button", { name: "8주" })).toHaveAttribute("aria-pressed", "true")
  })

  it("offers recording instead of empty rows or an accessible zero chart", async () => {
    const onWriteLog = vi.fn()
    const user = userEvent.setup()
    render(<EnergySystemLedgerPanel
      observations={[]}
      today="2026-08-28"
      planState={null}
      mode="full"
      onWriteLog={onWriteLog}
    />)

    expect(screen.getByText(/일지에 운동과 훈련 목적을 남기면/u)).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText(/계산 기준/u)).not.toBeInTheDocument()
    expect(screen.queryByText("저장된 계획 없음")).not.toBeInTheDocument()
    expect(screen.queryByText(/^0회$/u)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(onWriteLog).toHaveBeenCalledOnce()
  })

  it("keeps excluded source counts visible when there are no eligible purposes", () => {
    const excluded = { ...observation(), energySystem: null }
    render(<EnergySystemLedgerPanel observations={[excluded]} today="2026-08-28" planState={null} mode="full" />)

    expect(screen.getByText(/이 기간의 기록은 있지만/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "계산 기준 · 기록 0건 사용 · 1건 제외" })).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "운동 기록하기" })).not.toBeInTheDocument()
  })

  it("keeps the period selector usable when a wider range has actual records", async () => {
    const user = userEvent.setup()
    const older = { ...observation(), loggedOn: "2026-06-20" }
    render(<EnergySystemLedgerPanel observations={[older]} today="2026-08-28" planState={null} mode="full" />)

    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "24주" }))
    expect(screen.getByRole("img", { name: /LT 지속 페이스 1회/u })).toBeVisible()
    expect(screen.getByRole("img", { name: /MIX 여러 강도 조합 0회/u })).toBeVisible()
    expect(screen.getByRole("table", { name: "에너지 시스템별 일지 누적" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "4주" }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("keeps the compact home summary short while naming mixed allocation", () => {
    render(<EnergySystemLedgerPanel
      observations={[observation()]}
      today="2026-08-28"
      planState={stateFixture()}
      mode="compact"
    />)

    const region = screen.getByRole("region", { name: "에너지 시스템 요약" })
    expect(region).toBeVisible()
    expect(within(region).getByRole("heading", { level: 2, name: /에너지 시스템 기록/u })).toHaveClass("app-heading--section")
    expect(region.querySelector(".app-heading--accent")).toBeNull()
    expect(screen.getByText("MIX 여러 강도 조합 0회")).toBeVisible()
    expect(screen.getByText(/현재 계획 예정 1회 · 완료 표시 0회/u)).toBeVisible()
  })

  it("does not repeat an empty mixed category or evidence disclosure in compact mode", () => {
    render(<EnergySystemLedgerPanel
      observations={[]}
      today="2026-08-28"
      planState={null}
      mode="compact"
    />)

    expect(screen.getByText(/일지에 운동과 훈련 목적을 남기면/u)).toBeVisible()
    expect(screen.queryByText("MIX 여러 강도 조합 —")).not.toBeInTheDocument()
    expect(screen.queryByText("MIX 여러 강도 조합 0회")).not.toBeInTheDocument()
    expect(screen.queryByText(/집계 근거/u)).not.toBeInTheDocument()
  })
})
