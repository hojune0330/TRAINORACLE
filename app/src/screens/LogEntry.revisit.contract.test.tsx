import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-store"
import { loadEntries, replaceAllEntries } from "../domain/journal-store"
import { LogEntry } from "./LogEntry"

afterEach(cleanup)

const DATE = "2026-07-20"

describe("past journal revisit forms", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("prefills and replaces an evening check-in without changing its identity", async () => {
    // Given
    const user = userEvent.setup()
    const entry = {
      id: "past-evening",
      kind: "evening",
      date: DATE,
      savedAt: "2026-07-20T20:00:00.000Z",
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "61.2",
      restingHr: "48",
      painParts: { calf: 2 },
      mood: 4,
      note: "몸이 가벼웠다",
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    } satisfies JournalEntry
    expect(replaceAllEntries([entry]).ok).toBe(true)
    render(<LogEntry entryType="evening" initialEntry={entry} />)

    // Then
    expect(screen.getByRole("heading", { name: "입력 확인" })).toBeVisible()
    expect(screen.getByRole("button", { name: "체중 · 안정시 심박 수정" })).toBeVisible()
    expect(screen.queryByLabelText("수면 시간")).toBeNull()

    // Open only the requested group; other stored values remain summarized.
    await user.click(screen.getByRole("button", { name: "수면 수정" }))
    expect(screen.getByLabelText("수면 시간")).toHaveValue("8")
    expect(screen.getByRole("button", { name: "수면 질 4 좋음" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByLabelText("체중 (kg)")).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))

    await user.click(screen.getByRole("button", { name: "몸 상태 · 기분 수정" }))
    expect(screen.getByRole("button", { name: "감정 4 좋음" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByLabelText("수면 시간")).toBeNull()
    expect(screen.queryByLabelText("체중 (kg)")).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))

    // Open only the selected metric group, leaving the other answers summarized.
    await user.click(screen.getByRole("button", { name: "체중 · 안정시 심박 수정" }))
    expect(screen.queryByLabelText("수면 시간")).toBeNull()
    expect(screen.getByLabelText("체중 (kg)")).toHaveValue("61.2")
    expect(screen.getByLabelText("안정시 심박 (bpm)")).toHaveValue("48")
    expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()

    // When
    await user.clear(screen.getByLabelText("체중 (kg)"))
    await user.type(screen.getByLabelText("체중 (kg)"), "61.0")
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    expect(screen.getByRole("button", { name: "수면 수정" })).toBeVisible()
    expect(screen.getByRole("button", { name: "몸 상태 · 기분 수정" })).toBeVisible()
    expect(screen.getByRole("button", { name: "체중 · 안정시 심박 수정" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))

    // Then
    const [updated] = loadEntries()
    expect(updated).toEqual(
      expect.objectContaining({ id: entry.id, date: DATE, weightKg: "61.0" }),
    )
    expect(Date.parse(updated?.savedAt ?? "")).toBeGreaterThan(Date.parse(entry.savedAt))
  })

  it("reopens a post-race record in its recorded stage and replaces it in place", async () => {
    // Given
    const user = userEvent.setup()
    const entry = {
      id: "past-race",
      kind: "race",
      date: DATE,
      savedAt: "2026-07-20T19:00:00.000Z",
      syncState: "local",
      stage: "post",
      record: "16:42.18",
      rank: "2위",
      result: "결승 진출",
      memo: "마지막 300m를 밀었다",
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
      tension: 5,
      condition: 4,
      mood: 4,
      goalPace: { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm: 225 },
    } satisfies JournalEntry
    expect(replaceAllEntries([entry]).ok).toBe(true)
    render(<LogEntry entryType="race" initialEntry={entry} />)

    // Then
    expect(screen.getByRole("heading", { name: "입력 확인" })).toBeVisible()
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("경기 직후")
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("기록 16:42.18")
    expect(screen.queryByRole("textbox", { name: "경기 기록" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "경기 메모" })).toBeNull()

    // When
    await user.click(screen.getByRole("button", { name: "경기 정보 수정" }))
    expect(screen.getByRole("button", { name: "경기 직후" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "경기 기록" })).toHaveValue("16:42.18")
    expect(screen.getByRole("textbox", { name: "경기 순위" })).toHaveValue("2위")
    expect(screen.getByRole("textbox", { name: "경기 결과" })).toHaveValue("결승 진출")
    await user.clear(screen.getByRole("textbox", { name: "경기 결과" }))
    await user.type(screen.getByRole("textbox", { name: "경기 결과" }), "결승 2위")
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("결과 결승 2위")
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))

    // Then
    const [updated] = loadEntries()
    expect(updated).toEqual(
      expect.objectContaining({ id: entry.id, date: DATE, result: "결승 2위" }),
    )
    expect(Date.parse(updated?.savedAt ?? "")).toBeGreaterThan(Date.parse(entry.savedAt))
  })

  it("resets the form when another entry of the same kind is selected", async () => {
    // Given
    const user = userEvent.setup()
    const first = {
      id: "morning-session",
      kind: "post-session",
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "Morning run",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      intensityAssessment: {
        schemaVersion: 1,
        plannedRpe: 7,
        objectiveComponents: [{ componentId: "interval-fixture", kind: "INTERVALS", repetitions: 4, workSeconds: 60, recoverySeconds: 90 }],
      },
      memo: "",
    } satisfies JournalEntry
    const second = {
      ...first,
      id: "evening-session",
      savedAt: "2026-07-20T18:00:00.000Z",
      title: "Evening run",
      distanceKm: "8",
    } satisfies JournalEntry
    const { rerender } = render(<LogEntry entryType="post-session" initialEntry={first} />)
    expect(screen.getByRole("heading", { name: "입력 확인" })).toBeVisible()
    expect(screen.getByText(/Morning run/u)).toBeVisible()
    expect(screen.queryByLabelText("세션 제목")).toBeNull()

    // 강도 그룹에서는 계획 RPE와 기존 객관 구성을 함께 확인·수정할 수 있다.
    await user.click(screen.getByRole("button", { name: "운동 강도 수정" }))
    expect(screen.getByRole("button", { name: "예상 강도 7" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "강도 종합" })).toHaveTextContent("4회 · 운동 60초 / 회복 90초")
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))

    // 세션 제목은 해당 요약 항목에서만 연다.
    await user.click(screen.getByRole("button", { name: "실제로 한 운동 수정" }))
    expect(screen.getByLabelText("세션 제목")).toHaveValue("Morning run")

    // When
    rerender(<LogEntry entryType="post-session" initialEntry={second} />)

    // Then
    expect(screen.getByRole("heading", { name: "입력 확인" })).toBeVisible()
    expect(screen.getByText(/Evening run/u)).toBeVisible()
    expect(screen.getByText(/8 km/u)).toBeVisible()
    expect(screen.queryByLabelText("세션 제목")).toBeNull()
    expect(screen.queryByLabelText("거리 (km)")).toBeNull()

    // 세션 제목과 거리·시간은 각 요약 항목에서 별도로 연다.
    await user.click(screen.getByRole("button", { name: "실제로 한 운동 수정" }))
    expect(screen.getByLabelText("세션 제목")).toHaveValue("Evening run")
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: "거리와 시간 수정" }))
    expect(screen.getByLabelText("거리 (km)")).toHaveValue("8")
  })

  it("describes a historical chooser as the selected date rather than today", () => {
    // When
    const { container } = render(<LogEntry entryType="choose" targetDate={DATE} />)

    // Then
    expect(screen.getByText("이 날짜의 첫 일지예요. 원하는 항목만 남겨도 괜찮아요.")).toBeVisible()
    expect(screen.queryByText(/오늘 첫 일지/u)).not.toBeInTheDocument()
    expect(screen.getAllByText("이 날짜의 첫 일지예요. 원하는 항목만 남겨도 괜찮아요.")).toHaveLength(1)
    const intro = container.querySelector(".contextual-entry-intro")
    expect(intro).toContainElement(screen.getByRole("heading", { name: "어떤 일지를 쓰세요?" }))
    expect(intro).toHaveTextContent("이 날짜의 첫 일지예요.")
    expect(intro?.querySelector("img")).toHaveAttribute("width", "64")
    expect(intro?.querySelector("img")).toHaveAttribute("alt", "")
    expect(intro?.querySelector("img")).toHaveAttribute("aria-hidden", "true")
  })

  it("keeps a focused native screen heading while its four entry actions stay separate", () => {
    const { container } = render(<LogEntry entryType="choose" targetDate={DATE} />)
    const heading = screen.getByRole("heading", { name: "어떤 일지를 쓰세요?", level: 1 })

    expect(heading).toHaveClass("app-heading", "app-heading--screen", "app-heading--accent")
    expect(heading).toHaveAttribute("tabindex", "-1")
    expect(heading).toHaveFocus()
    expect(heading.style.fontSize).toBe("")
    expect(heading.style.fontWeight).toBe("")
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
    expect(container.querySelectorAll("[data-testid^='entry-choice-']")).toHaveLength(4)
    expect(screen.getByText("이 날짜의 첫 일지예요. 원하는 항목만 남겨도 괜찮아요.")).not.toHaveClass("app-heading")
  })

  it("limits the small guide to the selected empty date without changing the four choices or import action", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    const onOpenImport = vi.fn()
    const recordedDate = "2026-07-21"
    expect(replaceAllEntries([{
      id: "recorded-evening",
      kind: "evening",
      date: recordedDate,
      savedAt: "2026-07-21T20:00:00.000Z",
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "",
      restingHr: "",
      painParts: {},
      mood: 4,
      note: "",
    } satisfies JournalEntry]).ok).toBe(true)
    const view = render(<LogEntry entryType="choose" targetDate={DATE} onDone={onDone} onOpenImport={onOpenImport} />)

    expect(view.container.querySelectorAll("img")).toHaveLength(1)
    for (const [index, type] of ["quick-session", "post-session", "evening", "race"].entries()) {
      await user.click(screen.getByTestId(`entry-choice-${type}`))
      expect(onDone).toHaveBeenNthCalledWith(index + 1, type)
    }
    expect(view.container.querySelectorAll("[data-testid^='entry-choice-']")).toHaveLength(4)
    await user.click(screen.getByTestId("open-import"))
    expect(onOpenImport).toHaveBeenCalledOnce()

    view.rerender(<LogEntry entryType="choose" targetDate={recordedDate} onDone={onDone} onOpenImport={onOpenImport} />)
    expect(view.container.querySelector("img")).toBeNull()
    expect(screen.getByText("이 날짜에 남긴 일지가 있어요. 기록을 더 쓰면 같은 날짜에 모아 보여드려요.")).toBeVisible()
    expect(screen.queryByText(/첫 일지예요/u)).not.toBeInTheDocument()
  })

  it("describes a historical race as belonging to the selected date", () => {
    // When
    render(<LogEntry entryType="race" targetDate={DATE} />)

    // Then
    expect(screen.getByText("이 날짜의 경기")).toBeVisible()
    expect(screen.queryByText("오늘의 경기")).not.toBeInTheDocument()
  })
})
