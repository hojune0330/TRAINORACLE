import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import { Trends } from "../Trends"

const STORAGE_KEY = "trainoracle.journal.v1"

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
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trendEntries()))
  })

  it("offers a readable table for every chart after its analysis section is opened", async () => {
    // Given
    const user = userEvent.setup()
    render(<Trends />)

    // When — charts are mounted one analysis section at a time.
    await user.click(screen.getByRole("button", { name: "훈련량" }))
    const distance = screen.getByRole("region", { name: "누적 거리와 변화" })
    const distanceTableToggles = within(distance).getAllByText("표로 보기")
    for (const toggle of distanceTableToggles) await user.click(toggle)
    const distanceTables = within(distance).getAllByRole("table")
    const distanceCharts = within(distance).getAllByRole("img")

    // Then — preserve the existing table, chart and heatmap accessibility checks.
    expect(distanceTableToggles).toHaveLength(2)
    expect(distanceTables).toHaveLength(2)
    expect(distanceCharts).toHaveLength(2)
    expect(within(distance).getByRole("list", { name: /월 날짜별 거리/u })).toBeVisible()
    expect(within(distance).getAllByRole("listitem").some((item) => (
      item.getAttribute("aria-label")?.includes("킬로미터") ?? false
    ))).toBe(true)

    await user.click(screen.getByRole("button", { name: "훈련 구성" }))
    const mix = screen.getByRole("region", { name: "에너지 시스템 누적" })
    const mixTableToggles = within(mix).getAllByText("표로 보기")
    for (const toggle of mixTableToggles) await user.click(toggle)
    const mixTables = within(mix).getAllByRole("table")
    const mixCharts = within(mix).getAllByRole("img")
    expect(mixTableToggles).toHaveLength(1)
    expect(mixTables).toHaveLength(1)
    expect(mixCharts).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "월별 변화" }))
    const monthly = screen.getByRole("region", { name: "최근 4개월 추이" })
    const monthlyTableToggle = within(monthly).getByText("표로 보기")
    await user.click(monthlyTableToggle)
    const monthlyTables = within(monthly).getAllByRole("table")
    const monthlyCharts = within(monthly).getAllByRole("img")
    expect(monthlyTables).toHaveLength(1)
    expect(monthlyCharts).toHaveLength(1)
    const tableToggles = [...distanceTableToggles, ...mixTableToggles, monthlyTableToggle]
    const tables = [...distanceTables, ...mixTables, ...monthlyTables]
    const charts = [...distanceCharts, ...mixCharts, ...monthlyCharts]
    expect(tableToggles).toHaveLength(4)
    expect(tables).toHaveLength(4)
    expect(charts).toHaveLength(4)
    for (const metric of ["거리", "페이스", "기분", "통증"]) {
      await user.click(within(monthly).getByRole("button", { name: metric }))
      expect(within(monthly).getByRole("table", {
        name: `${metric} 최근 4개월 중앙값`,
      })).toBeVisible()
      expect(within(monthly).getByRole("img")).toHaveAccessibleName(
        new RegExp(`${metric} 최근 4개월`, "u"),
      )
    }
  })
})
