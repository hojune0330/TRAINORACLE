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
async function chooseDetail(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByText(/훈련량·구성·변화 보기|· 다른 항목 보기/u))
  await user.click(screen.getByRole("button", { name: label }))
}
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
  it("offers all six Oracle examples in the reading tab", async () => {
    const user = userEvent.setup()
    const onOpenOracle = vi.fn<(topic: OracleTopicId, mode?: "example" | "personal") => void>()
    render(<Trends onOpenOracle={onOpenOracle} />)

    expect(screen.getByRole("heading", { name: "오라클", level: 1 })).toBeVisible()
    expect(screen.getByRole("group", { name: "오라클 항목" })).toBeVisible()
    expect(screen.getAllByRole("button", { name: /^(내 훈련|러닝 취향|읽을거리·관심)$/u })).toHaveLength(3)
    expect(screen.getByText("예시 · 내 기록 분석이 아니에요")).toBeVisible()

    expect(screen.queryAllByRole("button", { name: /결과 보기/u })).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "읽을거리·관심" }))
    expect(screen.getByText("내 관심 주제·기록할 요일")).toBeVisible()
    const topicButtons = screen.getAllByRole("button", { name: /결과 보기/u })
    expect(topicButtons).toHaveLength(ORACLE_TOPICS.length)

    for (const topic of ORACLE_TOPICS) {
      await user.click(screen.getByRole("button", {
        name: `${topic.title} · ${topic.question} · 결과 보기`,
      }))
    }

    expect(onOpenOracle).toHaveBeenCalledTimes(ORACLE_TOPICS.length)
    expect(onOpenOracle.mock.calls.map(([topic]) => topic)).toEqual(ORACLE_TOPICS.map(topic => topic.id))
    expect(onOpenOracle.mock.calls.every(call => call[1] === "example")).toBe(true)
  })

  it("mounts only the selected analysis panel", async () => {
    const user = userEvent.setup()
    const onOpenImport = vi.fn()
    const onWriteLog = vi.fn()
    render(<Trends onOpenImport={onOpenImport} onWriteLog={onWriteLog} />)

    expect(screen.getByRole("heading", { name: "첫 운동부터 남겨볼까요?" })).toBeVisible()
    expect(screen.getByText("훈련량·구성·변화 보기")).toBeVisible()

    await chooseDetail(user, "훈련량")
    expect(screen.getByRole("region", { name: "누적 거리와 변화" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()

    await chooseDetail(user, "훈련 구성")
    expect(screen.getByRole("region", { name: "훈련 종류별 합계" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()

    await chooseDetail(user, "월별 변화")
    expect(screen.getByRole("region", { name: "최근 4개월 추이" })).toBeVisible()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).not.toBeInTheDocument()

    await chooseDetail(user, "파일 분석")
    expect(screen.getByRole("heading", { name: "운동 파일로 구간 살펴보기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "운동 파일 가져오기" }))
    expect(onOpenImport).toHaveBeenCalledOnce()
    expect(onWriteLog).not.toHaveBeenCalled()
    expect(screen.queryByRole("region", { name: "누적 거리와 변화" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "훈련 종류별 합계" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "최근 4개월 추이" })).not.toBeInTheDocument()
  })

  it("keeps profile and reading library as separate Oracle destinations", async () => {
    const user = userEvent.setup()
    const onOpenRunningProfile = vi.fn()
    const onOpenOracleLibrary = vi.fn()
    const onOracleSectionChange = vi.fn()
    render(<Trends oracleV2Enabled onOpenRunningProfile={onOpenRunningProfile} onOpenOracleLibrary={onOpenOracleLibrary} onOracleSectionChange={onOracleSectionChange} />)

    await user.click(screen.getByRole("button", { name: "러닝 취향" }))
    expect(onOpenRunningProfile).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "러닝 취향 보기" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "읽을거리·관심" }))
    expect(onOpenOracleLibrary).toHaveBeenCalledOnce()
    expect(onOracleSectionChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "내 훈련" })).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps the V1 reading section useful without claiming the V2 library is available", async () => {
    const user = userEvent.setup()
    const onOpenTrainingContent = vi.fn()
    render(<Trends onOpenTrainingContent={onOpenTrainingContent} />)

    await user.click(screen.getByRole("button", { name: "읽을거리·관심" }))
    expect(screen.queryByText("읽을거리 56편 · 8개 주제 묶음")).not.toBeInTheDocument()
    expect(onOpenTrainingContent).toHaveBeenCalledOnce()
  })

  it("uses only the enabled library destination without a second introduction", async () => {
    const user = userEvent.setup()
    const legacy = vi.fn(), v2 = vi.fn()
    const { rerender } = render(<Trends onOpenTrainingContent={legacy} onOpenOracleLibrary={v2} />)
    await user.click(screen.getByRole("button", { name: "읽을거리·관심" }))
    expect(legacy).toHaveBeenCalledOnce()
    expect(v2).not.toHaveBeenCalled()
    rerender(<Trends oracleV2Enabled onOpenTrainingContent={legacy} onOpenOracleLibrary={v2} />)
    await user.click(screen.getByRole("button", { name: "읽을거리·관심" }))
    expect(v2).toHaveBeenCalledOnce()
  })

  it("restores a selected Oracle section and preserves receipt context when choosing a chart", async () => {
    const user = userEvent.setup()
    const onContextChange = vi.fn()
    render(<Trends initialOracleSection="training" initialContext={{ section: "monthly", metric: "MOOD", savedDate: "2026-10-05" }} onContextChange={onContextChange} />)

    expect(screen.getByRole("button", { name: "내 훈련" })).toHaveAttribute("aria-pressed", "true")
    await chooseDetail(user, "월별 변화")
    expect(onContextChange).toHaveBeenLastCalledWith({ section: "monthly", metric: "MOOD", savedDate: "2026-10-05" })
    expect(screen.getByText("2026-10-05에 저장한 기분을 월별 기록과 함께 볼 수 있어요.")).toBeVisible()
  })

  it("keeps the file-analysis tab useful when the file feature is disabled", async () => {
    const user = userEvent.setup()
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "false")
    render(<Trends />)

    await chooseDetail(user, "파일 분석")
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

    expect(screen.getByText(/파일 기록 1건 · 확인 전 분석에서 제외/u)).toBeVisible()
    expect(screen.getByTestId("trends-analysis-exclusion")).toBeVisible()
    expect(screen.getByText("가져온 기록 1개 · 출처 미확인 1개 · 분석 제외 안내")).toBeVisible()

    await chooseDetail(user, "파일 분석")
    expect(screen.getByTestId("file-analysis-panel")).toBeVisible()
    expect(screen.getByText(/최신 상태를 계정에서 확인하지 못했어요/u)).toBeVisible()
    expect(screen.getByTestId("trends-analysis-exclusion")).toBeVisible()
  })
})
