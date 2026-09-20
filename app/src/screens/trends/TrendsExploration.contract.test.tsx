import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import { buildFileObservation } from "../../domain/import/file-observation"
import { putAccountJournalProjection, resetAccountJournalProjection } from "../../domain/account/account-journal-projection"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { ORACLE_TOPICS, type OracleTopicId } from "../../domain/oracle-exploration"
import { Trends } from "../Trends"

const STORAGE_KEY = "trainoracle.journal.v1"
const OWNER_ID = "trends-exploration-owner"
type PostSessionEntry = Extract<JournalEntry, { readonly kind: "post-session" }>

function baseSession(id: string, fieldProvenance?: PostSessionEntry["fieldProvenance"]): PostSessionEntry {
  const today = todayISO()
  return {
    id,
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
    ...(fieldProvenance === undefined ? {} : { fieldProvenance }),
  }
}

function pendingFileSession(): PostSessionEntry {
  const today = todayISO()
  return {
    ...baseSession("pending-file", {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    }),
    fileObservation: buildFileObservation({
      format: "tcx",
      sourceProfile: "TCX_ACTIVITY_V1",
      parserVersion: "v1",
      sourceActivityId: "pending-file-source",
      date: today,
      startedAt: null,
      timeZone: null,
      sport: "RUNNING",
      distanceMeters: 8000,
      durationSeconds: 2400,
      durationMeaning: "TIMER",
      confirmation: { durationMeaning: null, sport: null },
      laps: [{
        sourceIndex: 0,
        distanceMeters: 8000,
        durationSeconds: 2400,
        durationMeaning: "TIMER",
        kind: "UNKNOWN",
      }],
    }),
  }
}

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
  resetAccountJournalProjection(null)
  vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
  vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
  for (const format of ["CSV", "JSON", "GPX"]) {
    vi.stubEnv(`VITE_FEATURE_FILE_ANALYSIS_${format}`, "false")
    vi.stubEnv(`VITE_KILL_FILE_ANALYSIS_${format}`, "false")
  }
})

afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
  resetAccountJournalProjection(null)
  vi.unstubAllEnvs()
})

describe("Trends exploration hub", () => {
  it("offers all six Oracle topics from the empty summary", async () => {
    const user = userEvent.setup()
    const onOpenOracle = vi.fn<(topic: OracleTopicId) => void>()
    render(<Trends onOpenOracle={onOpenOracle} />)

    const topicButtons = screen.getAllByRole("button", { name: /예시 보기/u })
    expect(topicButtons).toHaveLength(ORACLE_TOPICS.length)

    for (const topic of ORACLE_TOPICS) {
      await user.click(screen.getByRole("button", {
        name: `${topic.title} · ${topic.question} · 예시 보기`,
      }))
    }

    expect(onOpenOracle).toHaveBeenCalledTimes(ORACLE_TOPICS.length)
    expect(onOpenOracle.mock.calls.map(([topic]) => topic)).toEqual(ORACLE_TOPICS.map(topic => topic.id))
  })

  it("mounts only the selected analysis panel", async () => {
    const user = userEvent.setup()
    render(<Trends />)

    expect(screen.getByRole("heading", { name: "분석할 기록이 아직 없어요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "요약" })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: "훈련량" }))
    expect(screen.getByRole("region", { name: "누적 거리와 변화" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "에너지 시스템 누적" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "훈련 구성" }))
    expect(screen.getByRole("region", { name: "에너지 시스템 누적" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "월별 변화" }))
    expect(screen.getByRole("region", { name: "최근 4개월 추이" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "에너지 시스템 누적" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "파일 분석" }))
    expect(screen.getByRole("heading", { name: "분석할 파일 기록이 없어요" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "에너지 시스템 누적" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()
  })

  it("keeps the file-analysis tab useful when the file feature is disabled", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "false")
    render(<Trends />)

    await user.click(screen.getByRole("button", { name: "파일 분석" }))
    expect(screen.getByRole("heading", { name: "파일 분석은 준비 중이에요" })).toBeVisible()
    expect(screen.getByText("현재는 일지에 직접 남긴 값으로 훈련량과 변화를 볼 수 있어요.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "훈련량 보기" }))
    expect(screen.getByRole("region", { name: "누적 거리와 변화" })).toBeVisible()
  })

  it("keeps pending-file and provenance-exclusion notices visible", async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      baseSession("legacy"),
      baseSession("imported", {
        distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      }),
    ] satisfies readonly JournalEntry[]))
    setActiveLocalAccount(OWNER_ID)
    resetAccountJournalProjection(OWNER_ID)
    expect(putAccountJournalProjection(OWNER_ID, pendingFileSession())).toBe(true)

    render(<Trends />)

    expect(screen.getByRole("status")).toHaveTextContent("파일 기록 1건 · 확인 전 분석에서 제외")
    expect(screen.getByTestId("trends-analysis-exclusion")).toBeVisible()
    expect(screen.getByText("가져온 기록 1개 · 출처 확인이 필요한 기록 1개 · 분석에서 제외된 항목 안내")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "파일 분석" }))
    expect(screen.getByTestId("file-analysis-panel")).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent("최신 상태")
    expect(screen.getByTestId("trends-analysis-exclusion")).toBeVisible()
  })
})
