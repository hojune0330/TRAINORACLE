import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { Trends } from "../Trends"
import { MonthlyTrendSection } from "./MonthlyTrendSection"
import { WeeklyDistanceSection } from "./WeeklyDistanceSection"

const STORAGE_KEY = "trainoracle.journal.v1"

function postSession(
  id: string,
  distanceKm: string,
  fieldProvenance?: JournalEntry["fieldProvenance"],
): JournalEntry {
  const today = todayISO()
  return {
    id,
    kind: "post-session",
    date: today,
    savedAt: `${today}T08:00:00.000Z`,
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm,
    durationMin: "40",
    avgPace: "5:00",
    rpe: 4,
    memo: "",
    ...(fieldProvenance === undefined ? {} : { fieldProvenance }),
  }
}

function entries(): readonly JournalEntry[] {
  const today = todayISO()
  return [
    postSession("explicit", "8", {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    }),
    postSession("legacy", "12"),
    postSession("imported", "20", {
      distanceKm: {
        provenance: "DERIVED",
        derivedFrom: ["import:activity-file"],
        derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
      },
      durationMin: { provenance: "MISSING" },
      avgPace: { provenance: "MISSING" },
      rpe: { provenance: "MISSING" },
    }),
    {
      id: "evening",
      kind: "evening",
      date: today,
      savedAt: `${today}T20:00:00.000Z`,
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { knee: 4 },
      mood: 4,
      note: "",
      fieldProvenance: {
        sleepH: { provenance: "MISSING" },
        sleepQuality: { provenance: "MISSING" },
        weightKg: { provenance: "MISSING" },
        restingHr: { provenance: "MISSING" },
        painParts: { provenance: "EXPLICIT" },
        mood: { provenance: "EXPLICIT" },
      },
    },
  ]
}

afterEach(cleanup)

describe("provenance-safe Trends surface", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries()))
  })

  it("shows only verified weekly distance and explains excluded records", () => {
    render(<Trends />)

    const weekly = screen.getByRole("region", { name: "최근 4주 거리" })
    expect(within(weekly).getByText(/^8$/u)).toBeVisible()
    expect(within(weekly).getByText(/집계 사용 1건/u)).toBeVisible()
    expect(within(weekly).getByText(/집계 제외 2건/u)).toBeVisible()
    expect(screen.queryByText(/전체 누적/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/기준:\s*데모|과다|통증·피로/u)).not.toBeInTheDocument()
  })

  it("switches among four-month descriptive metrics without judgment copy", async () => {
    const user = userEvent.setup()
    render(<Trends />)

    const monthly = screen.getByRole("region", { name: "최근 4개월 추이" })
    expect(within(monthly).getByRole("button", { name: "페이스" })).toHaveAttribute("aria-pressed", "true")
    expect(within(monthly).getByText(/중앙 페이스 5:00/u)).toBeVisible()
    expect(within(monthly).getAllByText(/표본 1건/u).some((element) =>
      element.tagName === "DIV")).toBe(true)

    await user.click(within(monthly).getByRole("button", { name: "기분" }))
    expect(within(monthly).getByText(/중앙 기분 4\/5/u)).toBeVisible()

    await user.click(within(monthly).getByRole("button", { name: "통증" }))
    expect(within(monthly).getByText(/중앙 통증 4\/5/u)).toBeVisible()

    await user.click(within(monthly).getByRole("button", { name: "거리" }))
    expect(within(monthly).getByText(/중앙 거리 8 km/u)).toBeVisible()
    expect(within(monthly).queryByText(
      /준비가 됐|부상 위험|좋아졌|나빠졌|다음 훈련/u,
    )).not.toBeInTheDocument()
  })
})

function statusObservation(
  sourceId: string,
  trustState: StructuredJournalObservation["sourceRef"]["trustState"],
): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: "2026-07-10T08:00:00.000Z",
      trustState,
      containsPrivateRawText: false,
    },
    loggedOn: "2026-07-10",
    distanceKm: 8,
    durationMin: 40,
    secondsPerKm: 300,
    rpe: 4,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      distanceKm: "EXPLICIT",
      durationMin: "EXPLICIT",
      secondsPerKm: "EXPLICIT",
      rpe: "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("non-color source states", () => {
  it("names stale and conflicting sources in visible text", () => {
    render(<MonthlyTrendSection
      observations={[statusObservation("stale", "STALE")]}
      today="2026-07-27"
    />)
    expect(screen.getByText(/오래된 출처 · 확인 필요/u)).toBeVisible()

    cleanup()
    render(<MonthlyTrendSection
      observations={[statusObservation("conflict", "CONFLICTING")]}
      today="2026-07-27"
    />)
    expect(screen.getByText(/출처 충돌 · 확인 필요/u)).toBeVisible()
  })

  it("does not call a stale weekly source confirmed", async () => {
    const user = userEvent.setup()
    render(<WeeklyDistanceSection
      observations={[statusObservation("stale-week", "STALE")]}
      today="2026-07-10"
    />)

    expect(screen.getByText(/집계 사용 1건/u)).toBeVisible()
    expect(screen.queryByText(/출처 확인 1건/u)).not.toBeInTheDocument()
    await user.click(screen.getByText("출처 기록 보기"))
    expect(screen.getByText(/stale-week · 확인 필요/u)).toBeVisible()
  })
})
