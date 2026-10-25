import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-storage-keys"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { Trends } from "../Trends"

const STORAGE_KEY = JOURNAL_STORAGE_KEY

function trendEntries(): readonly JournalEntry[] {
  const today = todayISO()
  return [
    {
      id: "trend-session",
      kind: "post-session",
      date: today,
      savedAt: `${today}T08:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "이지런",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 4,
      memo: "",
      fieldProvenance: {
        system: { provenance: "EXPLICIT" },
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    },
    {
      id: "trend-evening",
      kind: "evening",
      date: today,
      savedAt: `${today}T20:00:00.000Z`,
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "60",
      restingHr: "48",
      painParts: { rKnee: 4 },
      mood: 4,
      note: "",
      fieldProvenance: {
        sleepH: { provenance: "EXPLICIT" },
        sleepQuality: { provenance: "EXPLICIT" },
        weightKg: { provenance: "EXPLICIT" },
        restingHr: { provenance: "EXPLICIT" },
        painParts: { provenance: "EXPLICIT" },
        mood: { provenance: "EXPLICIT" },
      },
    },
  ]
}

afterEach(cleanup)

describe("trend chart alternatives", () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await initializeCanonicalJournalFixture()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trendEntries()))
  })

  it("offers a readable table for every chart after its analysis section is opened", async () => {
    // Given
    const user = userEvent.setup()
    render(<Trends />)

    // When — charts are mounted one analysis section at a time.
    await user.click(screen.getByRole("button", { name: "훈련량" }))
    const distance = screen.getByRole("region", { name: "기간별 훈련 리포트" })
    const distanceTableToggles = within(distance).getAllByText("표로 보기")
    for (const toggle of distanceTableToggles) await user.click(toggle)
    const distanceTables = within(distance).getAllByRole("table")
    const distanceCharts = within(distance).getAllByRole("img")

    // Then — preserve the existing table, chart and heatmap accessibility checks.
    expect(distanceTableToggles).toHaveLength(1)
    expect(distanceTables).toHaveLength(1)
    expect(distanceCharts).toHaveLength(1)
    expect(distanceCharts[0]).toHaveAccessibleName(/월별 누적 거리.*8 km/u)
    expect(within(distance).getByRole("group", { name: "근거를 볼 월 선택" }).querySelectorAll("button")).toHaveLength(3)

    await user.click(screen.getByRole("button", { name: "훈련 구성" }))
    const mix = screen.getByRole("region", { name: "기간별 훈련 리포트" })
    const mixTableToggles = within(mix).getAllByText("표로 보기")
    for (const toggle of mixTableToggles) if (!toggle.closest("details")?.open) await user.click(toggle)
    const mixTables = within(mix).getAllByRole("table")
    const mixCharts = within(mix).getAllByRole("img")
    expect(mixTableToggles).toHaveLength(1)
    expect(mixTables).toHaveLength(1)
    expect(mixCharts).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "월별 변화" }))
    const monthly = screen.getByRole("region", { name: "기간별 훈련 리포트" })
    const monthlyTableToggle = within(monthly).getByText("표로 보기")
    if (!monthlyTableToggle.closest("details")?.open) await user.click(monthlyTableToggle)
    const monthlyTables = within(monthly).getAllByRole("table")
    const monthlyCharts = within(monthly).getAllByRole("img")
    expect(monthlyTables).toHaveLength(1)
    expect(monthlyCharts).toHaveLength(1)
    const tableToggles = [...distanceTableToggles, ...mixTableToggles, monthlyTableToggle]
    const tables = [...distanceTables, ...mixTables, ...monthlyTables]
    const charts = [...distanceCharts, ...mixCharts, ...monthlyCharts]
    expect(tableToggles).toHaveLength(3)
    expect(tables).toHaveLength(3)
    expect(charts).toHaveLength(3)
    for (const metric of ["거리", "페이스", "기분", "통증"]) {
      await user.click(within(monthly).getByRole("button", { name: /^지표 선택:/u }))
      await user.click(within(monthly).getByRole("button", { name: metric }))
      expect(within(monthly).getByRole("table", {
        name: `내 기록 · ${metric} · 월별 중앙값`,
      })).toBeVisible()
      expect(within(monthly).getByRole("img")).toHaveAccessibleName(
        new RegExp(`${metric} · 월별 중앙값`, "u"),
      )
    }
  })
})
